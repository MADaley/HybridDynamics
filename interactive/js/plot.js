/*
 * plot.js
 * Small canvas plotting library for the Spring-Mass Running Lab, written to
 * the Daley lab figure style: left and bottom axes only, ticks out, no
 * gridlines, no box, one y axis per panel (stacked panels or small
 * multiples), series told apart by color and line width, solid lines, one
 * marker shape (filled circle), legends without frames, and dotted grey
 * reference lines only where a crossing carries physical meaning.
 *
 * Plot.render(canvas, spec)
 *   spec.panels : array of panel objects (below)
 *   spec.cols   : number of columns (default 1)
 *   spec.panelHeight : height of each panel in CSS pixels (default 190)
 *   spec.alt    : text alternative, written to the canvas aria-label
 * Panel
 *   xLabel, yLabel, title, xLim [a, b], yLim [a, b], square (bool)
 *   series : [{x, y, label, style (0-3), points (bool), color (CSS)}]
 *   refs   : [{y: v} | {x: v} | {identity: true}]
 *   shade  : [{x0, x1}]
 *   legend : 'tl' | 'tr' | 'bl' | 'br' | 'outside' (right of the axes) | null
 *   heat   : {x0, x1, y0, y1, nx, ny, values (row-major, ny rows), vmin, vmax}
 *   marks  : [{x, y}] open circles for a current setting
 */
var Plot = (function () {
  'use strict';

  var WIDTHS = [3, 2, 1.3, 0.8];        // line width ladder (CSS px)
  var RADII = [5.5, 4.5, 3.5, 2.8];     // marker radius ladder (CSS px)
  var MARGIN = { left: 60, right: 14, top: 18, bottom: 44 };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function colors() {
    return {
      ink: cssVar('--ink'),
      text: cssVar('--text'),
      grey: cssVar('--grey'),
      shade: cssVar('--shade'),
      panel: cssVar('--panel-bg'),
      heatLow: cssVar('--heat-low'),
      heatHigh: cssVar('--heat-high'),
      series: [cssVar('--s1'), cssVar('--s2'), cssVar('--s3'), cssVar('--s4'), cssVar('--s5')]
    };
  }

  function fontFamily() {
    return cssVar('--font') || 'Roboto, Helvetica, Arial, sans-serif';
  }

  /* ---------- Canvas sizing for sharp lines on high-density screens ---------- */
  function prepare(canvas, cssHeight) {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(canvas.clientWidth || canvas.parentNode.clientWidth || 300, 120);
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, cssHeight);
    return { ctx: ctx, w: w, h: cssHeight };
  }

  /* ---------- Ticks ---------- */
  function niceStep(span, n) {
    var raw = span / Math.max(n, 1);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / mag;
    var nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    return nice * mag;
  }

  function ticks(lo, hi, n) {
    if (!(hi > lo)) return { values: [lo], step: 1 };
    var out, step;
    for (var tries = 0; tries < 6; tries++) {
      step = niceStep(hi - lo, n + 2 * tries);
      out = [];
      var start = Math.ceil(lo / step - 1e-9) * step;
      for (var v = start; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
      if (out.length >= 3) break;
    }
    return { values: out, step: step };
  }

  function fmtTick(v, step) {
    var d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return v.toFixed(Math.min(d, 6));
  }

  function extent(values, pad) {
    var lo = Infinity, hi = -Infinity;
    values.forEach(function (v) {
      if (v !== null && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    });
    if (!isFinite(lo)) return [0, 1];
    // A nearly constant series (for example a periodic gait, constant to
    // 1e-9) gets a span of 2 percent of its mean, so solver noise does not
    // fill the axis.
    var mid = 0.5 * (lo + hi);
    var minSpan = Math.max(0.02 * Math.abs(mid), 1e-3);
    if (hi - lo < minSpan) { lo = mid - minSpan / 2; hi = mid + minSpan / 2; return [lo, hi]; }
    var p = (hi - lo) * (pad === undefined ? 0.06 : pad);
    return [lo - p, hi + p];
  }

  /* ---------- One panel ---------- */
  function legendWidth(ctx, panel, font) {
    if (panel.legend !== 'outside') return 0;
    ctx.font = '12px ' + font;
    var w = 0;
    (panel.series || []).forEach(function (s) {
      if (s.label) w = Math.max(w, ctx.measureText(s.label).width);
    });
    return w + 22 + 6 + 16;
  }

  function drawPanel(ctx, box, panel, C, reserve) {
    var font = fontFamily();
    // Data ranges
    var xs = [], ys = [];
    (panel.series || []).forEach(function (s) {
      for (var i = 0; i < s.x.length; i++) {
        if (s.x[i] !== null && s.y[i] !== null && isFinite(s.x[i]) && isFinite(s.y[i])) {
          xs.push(s.x[i]); ys.push(s.y[i]);
        }
      }
    });
    (panel.refs || []).forEach(function (r) {
      if (r.y !== undefined && panel.includeRefs !== false) ys.push(r.y);
    });
    var xl = panel.xLim || extent(xs, 0.02);
    var yl = panel.yLim || extent(ys, 0.08);
    if (panel.heat) { xl = panel.xLim || [panel.heat.x0, panel.heat.x1]; yl = panel.yLim || [panel.heat.y0, panel.heat.y1]; }

    var legendW = Math.max(reserve || 0, legendWidth(ctx, panel, font));
    var plot = {
      x: box.x + MARGIN.left, y: box.y + MARGIN.top,
      w: box.w - MARGIN.left - MARGIN.right - (panel.heat ? 56 : 0) - legendW,
      h: box.h - MARGIN.top - MARGIN.bottom
    };
    if (panel.square) {
      var side = Math.min(plot.w, plot.h);
      plot.w = side; plot.h = side;
    }
    var sx = function (v) { return plot.x + (v - xl[0]) / (xl[1] - xl[0]) * plot.w; };
    var sy = function (v) { return plot.y + plot.h - (v - yl[0]) / (yl[1] - yl[0]) * plot.h; };

    ctx.save();
    // Shaded spans (behind everything)
    (panel.shade || []).forEach(function (s) {
      ctx.fillStyle = C.shade;
      var a = Math.max(sx(s.x0), plot.x), b = Math.min(sx(s.x1), plot.x + plot.w);
      if (b > a) ctx.fillRect(a, plot.y, b - a, plot.h);
    });

    // Heat map cells
    if (panel.heat) drawHeat(ctx, panel.heat, sx, sy, C, plot, font);

    // Reference lines: dotted, thin, grey
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x, plot.y, plot.w, plot.h);
    ctx.clip();
    ctx.strokeStyle = C.grey;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    (panel.refs || []).forEach(function (r) {
      ctx.beginPath();
      if (r.identity) {
        var lo = Math.max(xl[0], yl[0]), hi = Math.min(xl[1], yl[1]);
        ctx.moveTo(sx(lo), sy(lo)); ctx.lineTo(sx(hi), sy(hi));
      } else if (r.y !== undefined) {
        ctx.moveTo(plot.x, sy(r.y)); ctx.lineTo(plot.x + plot.w, sy(r.y));
      } else if (r.x !== undefined) {
        ctx.moveTo(sx(r.x), plot.y); ctx.lineTo(sx(r.x), plot.y + plot.h);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Series: lines, then markers
    (panel.series || []).forEach(function (s, k) {
      var st = s.style === undefined ? k : s.style;
      var col = s.color || C.series[st % C.series.length];
      if (!s.points || s.line) {
        ctx.strokeStyle = col;
        ctx.lineWidth = s.width || WIDTHS[st % 4];
        ctx.lineJoin = 'round';
        ctx.beginPath();
        var pen = false;
        for (var i = 0; i < s.x.length; i++) {
          var ok = s.x[i] !== null && s.y[i] !== null && isFinite(s.x[i]) && isFinite(s.y[i]);
          if (!ok) { pen = false; continue; }
          if (pen) ctx.lineTo(sx(s.x[i]), sy(s.y[i])); else ctx.moveTo(sx(s.x[i]), sy(s.y[i]));
          pen = true;
        }
        ctx.stroke();
      }
      if (s.points) {
        ctx.fillStyle = col;
        var r = s.radius || RADII[st % 4];
        for (var j = 0; j < s.x.length; j++) {
          if (s.x[j] === null || s.y[j] === null || !isFinite(s.x[j]) || !isFinite(s.y[j])) continue;
          ctx.beginPath();
          ctx.arc(sx(s.x[j]), sy(s.y[j]), r, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    });

    // Marks for the current setting: open circle in ink
    (panel.marks || []).forEach(function (m) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(m.x), sy(m.y), 7, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = C.panel;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx(m.x), sy(m.y), 9, 0, 2 * Math.PI);
      ctx.stroke();
    });
    ctx.restore();

    // Axes: left and bottom rulers, ticks out
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.x, plot.y);
    ctx.lineTo(plot.x, plot.y + plot.h);
    ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
    ctx.stroke();
    ctx.font = '12px ' + font;
    var tx = ticks(xl[0], xl[1], Math.max(3, Math.floor(plot.w / 70)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    tx.values.forEach(function (v) {
      var X = sx(v);
      ctx.beginPath(); ctx.moveTo(X, plot.y + plot.h); ctx.lineTo(X, plot.y + plot.h + 5); ctx.stroke();
      ctx.fillText(fmtTick(v, tx.step), X, plot.y + plot.h + 7);
    });
    var ty = ticks(yl[0], yl[1], Math.max(3, Math.floor(plot.h / 40)));
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ty.values.forEach(function (v) {
      var Y = sy(v);
      ctx.beginPath(); ctx.moveTo(plot.x, Y); ctx.lineTo(plot.x - 5, Y); ctx.stroke();
      ctx.fillText(fmtTick(v, ty.step), plot.x - 7, Y);
    });
    // Axis labels
    ctx.font = '13px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (panel.xLabel) ctx.fillText(panel.xLabel, plot.x + plot.w / 2, box.y + box.h - 4);
    if (panel.yLabel) {
      ctx.save();
      ctx.translate(box.x + 14, plot.y + plot.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'middle';
      ctx.fillText(panel.yLabel, 0, 0);
      ctx.restore();
    }
    if (panel.title) {
      ctx.font = 'bold 13px ' + font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(panel.title, plot.x, plot.y - 4);
    }
    if (panel.legend) drawLegend(ctx, panel, plot, C, font);
    ctx.restore();
  }

  function drawLegend(ctx, panel, plot, C, font) {
    var items = (panel.series || []).filter(function (s) { return s.label; });
    if (!items.length) return;
    ctx.font = '12px ' + font;
    var lineH = 17, sample = 22;
    var wMax = 0;
    items.forEach(function (s) { wMax = Math.max(wMax, ctx.measureText(s.label).width); });
    var W = sample + 6 + wMax, H = items.length * lineH;
    var pos = panel.legend;
    var x0, y0;
    if (pos === 'outside') {
      x0 = plot.x + plot.w + 14;
      y0 = plot.y + Math.max(0, (plot.h - H) / 2);
    } else {
      x0 = pos.indexOf('r') >= 0 ? plot.x + plot.w - W - 6 : plot.x + 10;
      y0 = pos.indexOf('b') >= 0 ? plot.y + plot.h - H - 6 : plot.y + 6;
    }
    items.forEach(function (s, i) {
      var st = s.style === undefined ? (panel.series.indexOf(s)) : s.style;
      var col = s.color || C.series[st % C.series.length];
      var yy = y0 + i * lineH + lineH / 2;
      if (s.points && !s.line) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x0 + sample / 2, yy, s.radius || RADII[st % 4], 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.strokeStyle = col;
        ctx.lineWidth = s.width || WIDTHS[st % 4];
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + sample, yy); ctx.stroke();
      }
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, x0 + sample + 6, yy);
    });
  }

  /* ---------- Heat map with a single-hue sequential scale ---------- */
  function parseColor(c) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c.trim());
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) return m[1].split(',').slice(0, 3).map(function (v) { return parseFloat(v); });
    return [128, 128, 128];
  }

  function mix(a, b, t) {
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }).join(',') + ')';
  }

  function drawHeat(ctx, H, sx, sy, C, plot, font) {
    var lo = parseColor(C.heatLow), hi = parseColor(C.heatHigh);
    var dx = (H.x1 - H.x0) / H.nx, dy = (H.y1 - H.y0) / H.ny;
    var vmin = H.vmin || 0, vmax = H.vmax || 1;
    for (var j = 0; j < H.ny; j++) {
      for (var i = 0; i < H.nx; i++) {
        var v = H.values[j * H.nx + i];
        if (v === null || v === undefined || !isFinite(v)) continue;
        var t = Math.max(0, Math.min(1, (v - vmin) / (vmax - vmin)));
        ctx.fillStyle = mix(lo, hi, t);
        var X0 = sx(H.x0 + i * dx), X1 = sx(H.x0 + (i + 1) * dx);
        var Y0 = sy(H.y0 + (j + 1) * dy), Y1 = sy(H.y0 + j * dy);
        ctx.fillRect(X0, Y0, X1 - X0 + 0.6, Y1 - Y0 + 0.6);
      }
    }
    // Color bar
    var bx = plot.x + plot.w + 18, bw = 12, by = plot.y, bh = plot.h;
    for (var k = 0; k < bh; k++) {
      ctx.fillStyle = mix(lo, hi, 1 - k / bh);
      ctx.fillRect(bx, by + k, bw, 1.2);
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.fillStyle = C.ink;
    ctx.font = '11px ' + font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    [vmin, (vmin + vmax) / 2, vmax].forEach(function (v) {
      var Y = by + bh - (v - vmin) / (vmax - vmin) * bh;
      ctx.beginPath(); ctx.moveTo(bx + bw, Y); ctx.lineTo(bx + bw + 4, Y); ctx.stroke();
      ctx.fillText(String(Math.round(v)), bx + bw + 6, Y);
    });
    if (H.label) {
      ctx.save();
      ctx.translate(bx + bw + 30, by + bh / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(H.label, 0, 0);
      ctx.restore();
    }
  }

  /* ---------- Layout of several panels ---------- */
  function render(canvas, spec) {
    var cols = spec.cols || 1;
    var n = spec.panels.length;
    var rows = Math.ceil(n / cols);
    var ph = spec.panelHeight || 190;
    var prep = prepare(canvas, rows * ph);
    var C = colors();
    var cw = prep.w / cols;
    // In a single column, every panel keeps the same plot width so that
    // stacked time axes line up, even when one panel has an outside legend.
    var reserve = 0;
    if (cols === 1) {
      spec.panels.forEach(function (panel) {
        reserve = Math.max(reserve, legendWidth(prep.ctx, panel, fontFamily()));
      });
    }
    spec.panels.forEach(function (panel, i) {
      var r = Math.floor(i / cols), c = i % cols;
      drawPanel(prep.ctx, { x: c * cw, y: r * ph, w: cw, h: ph }, panel, C, reserve);
    });
    if (spec.alt) {
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', spec.alt);
    }
  }

  return { render: render, colors: colors, WIDTHS: WIDTHS, RADII: RADII, extent: extent, prepare: prepare };
}());
