function s = daleyStyle(mode)
% DALEYSTYLE  Prof. Daley's data-viz house style: palette + axis styler (MATLAB).
%
%   s = daleyStyle();              publication preset (DEFAULT)
%   s = daleyStyle('publication'); explicit
%   s = daleyStyle('teaching');    slide-deck preset
%
%   PUBLICATION (default): black rulers/text, Arial, 8 pt ticks / 9 pt labels,
%     10 pt bold A/B/C panel labels, journal column widths, 300 dpi raster.
%     Series order leads with Wong blue; navy moves to the end, because at print
%     size navy sits too close to the black axis furniture.
%   TEACHING: navy rulers/text, Roboto, 11 pt ticks / 13 pt labels, screen and
%     projection sizing, 200 dpi. Matches the slide decks.
%
%   Struct fields:
%     .mode        the active preset name
%     .col         named colours (Wong/Tol colourblind-safe set)
%     .order       [7x3] series colour order for this preset
%     .linewidths  redundant-encoding ladder in pt (colour is never the only cue)
%     .markersizes the same ladder as circle diameters, for discrete data
%     .marker      the one house marker shape ('o'); shape never encodes series
%     .series(i) / .points(i)   name-value argument cells for series i
%     .font        preferred font name (falls back automatically if absent)
%     .fontsize / .labelsize / .panelsize   type sizes in pt
%     .widths      struct of journal column widths in inches
%     .figsize(w,n)     [width height] in inches for w = 'single'|'onehalf'|'double'
%     .figure(w,n)      new figure sized for that column width
%     .panelLabel(ax,'A')   10 pt bold panel tag above-left of the axes
%     .apply(ax)        applies the house style to one axes handle
%     .save(fig,name)   exports PDF (vector) + PNG at the preset's dpi
%
%   House-style rules enforced by .apply (both presets):
%     * NO box / NO mirrored axes  -> only left + bottom rulers (box off).
%     * NO gridlines               -> grid off.
%     * white background, tick direction out.
%   Redundant encoding is colour + line thickness. Series lines stay solid: dash
%   patterns are reserved for reference lines, and marker shape never varies.
%   Legends: draw with 'Box','off'. Zero/reference lines and separate-vs-overlaid
%   panels are the caller's choice, drawn only where physically informative.
%
%   USAGE
%     S = daleyStyle();                          % publication
%     f = S.figure('single', 3);                 % 89 mm wide, 3 stacked panels
%     ax = subplot(3,1,1); hold(ax,'on');
%     a = S.series(1); plot(ax, t, y, a{:});     % colour + width, solid
%     b = S.points(2); plot(ax, x, m, b{:});     % discrete data: circles
%     yline(ax, 0, ':', 'Color', S.col.grey, 'LineWidth', S.reflinewidth);
%     S.apply(ax); S.panelLabel(ax, 'A');
%     S.save(f, 'figure_name');
%   Assign S.series(i) to a variable first: MATLAB cannot expand {:} directly on a
%   function-call result.
%
%   Thickness supports four levels; the ladder repeats from series 5 on. With five
%   or more series use tiledlayout small multiples or label the lines directly.
%
%   Portable: drop into any project's code folder. Part of the daley-data-vis skill.

    if nargin < 1 || isempty(mode), mode = 'publication'; end
    mode = validatestring(mode, {'publication','teaching'});

    % NB: write RGB as doubles in [0,1]. Do NOT use hex literals like
    % [0x1f 0x3a 0x68]/255 — MATLAB hex literals are uint8, so the /255 is
    % integer division and every colour collapses to [0 0 0] (black).
    hex = @(r,g,b) [r g b] / 255;
    col = struct( ...
        'navy',      hex( 31, 58,104), ...   % #1f3a68
        'magenta',   hex(170, 68,153), ...   % #AA4499
        'teal',      hex(  0,158,115), ...   % #009E73
        'blue',      hex(  0,114,178), ...   % #0072B2
        'orange',    hex(230,159,  0), ...   % #E69F00
        'purple',    hex(204,121,167), ...   % #CC79A7
        'skyblue',   hex( 86,180,233), ...   % #56B4E9
        'grey',      hex(108,117,125), ...   % #6c757d
        'lightgrey', hex(207,212,220), ...   % #cfd4dc
        'rawgrey',   [0.62 0.62 0.62], ...   % raw / unfiltered trace
        'black',     [0 0 0]);

    switch mode
        case 'publication'
            order = [col.blue; col.magenta; col.teal; col.orange; ...
                     col.purple; col.skyblue; col.navy];
            ms    = [5.0 4.0 3.0 2.2 5.0 4.0 3.0];   % smaller: a 89 mm column shrinks
            ink   = col.black;
            fonts = {'Arial','Helvetica','Helvetica Neue'};
            tickpt = 8; labelpt = 9; titlept = 9; titleweight = 'normal';
            dpi = 300; ticklen = 0.020;
        case 'teaching'
            order = [col.navy; col.magenta; col.teal; col.blue; col.orange; ...
                     col.purple; col.skyblue];
            ms    = [8.0 6.0 4.5 3.4 8.0 6.0 4.5];
            ink   = col.navy;
            fonts = {'Roboto','Helvetica Neue','Helvetica','Arial'};
            tickpt = 11; labelpt = 13; titlept = 15; titleweight = 'bold';
            dpi = 200; ticklen = 0.025;
    end

    % Redundant encoding: colour + line thickness. Four perceptible width levels
    % (pt) spanning the standard 0.5-2.0 range, each about 1.6x the next; the ladder
    % repeats from series 5 on, where colour alone separates the pair. Hard bounds:
    % nothing thinner than 0.3 pt, nothing thicker than 2.0 pt.
    lw = [2.0 1.25 0.8 0.5 2.0 1.25 0.8];

    % Journal column widths in inches: 89 mm, 140 mm, 183 mm.
    widths = struct('single', 3.50, 'onehalf', 5.51, 'double', 7.20);
    maxheight = 9.00;   % a figure taller than this will not fit the page

    font = pickFont(fonts);

    s = struct();
    s.mode         = mode;
    s.col          = col;
    s.ink          = ink;
    s.order        = order;
    s.linewidths   = lw;
    s.markersizes  = ms;
    s.marker       = 'o';                 % one shape for every series
    s.minlinewidth = 0.3;                 % floor: reference lines, whiskers, annotations
    s.maxlinewidth = 2.0;                 % ceiling for any line in the figure
    s.reflinewidth = 0.3;                 % below the thinnest data line (0.5 pt)
    s.font         = font;
    s.fontsize     = tickpt;
    s.labelsize    = labelpt;
    s.panelsize    = 10;                  % pt, bold, for A/B/C tags
    s.dpi          = dpi;
    s.widths       = widths;
    s.maxheight    = maxheight;
    s.series       = @(i) seriesArgs(i, order, lw);
    s.points       = @(i) pointArgs(i, order, ms);
    s.figsize      = @(w, varargin) figSize(w, widths, maxheight, varargin{:});
    s.figure       = @(varargin) newFigure(widths, maxheight, varargin{:});
    s.panelLabel   = @(ax, txt, varargin) panelLabel(ax, txt, font, ink, varargin{:});
    s.apply        = @(ax) applyAxis(ax, order, ink, font, tickpt, labelpt, ...
                                     titlept, titleweight, ticklen);
    s.save         = @(fig, name, varargin) saveFig(fig, name, dpi, varargin{:});
end


function args = seriesArgs(i, order, lw)
% Line arguments for series i: house colour + width, solid, no marker.
    k = mod(i-1, size(order,1)) + 1;
    args = {'Color', order(k,:), 'LineStyle', '-', 'LineWidth', lw(k)};
end


function args = pointArgs(i, order, ms)
% Marker arguments for series i: house colour + circle diameter, no line.
    k = mod(i-1, size(order,1)) + 1;
    args = {'Color', order(k,:), 'LineStyle','none', 'Marker','o', ...
            'MarkerSize', ms(k), 'MarkerFaceColor', order(k,:), ...
            'MarkerEdgeColor','none'};
end


function wh = figSize(w, widths, maxheight, panels, aspect)
% [width height] in inches at a standard journal column width.
%   panels  number of stacked panels (default 1)
%   aspect  height of ONE panel as a fraction of the column width; defaults to
%           0.75 for a single panel and 0.45 for each panel of a stack.
    if nargin < 4 || isempty(panels), panels = 1; end
    if nargin < 5 || isempty(aspect)
        if panels == 1, aspect = 0.75; else, aspect = 0.45; end
    end
    if ~isfield(widths, w)
        error('daleyStyle:width', 'width must be single, onehalf or double; got %s', w);
    end
    width = widths.(w);
    wh = [width, min(width * aspect * panels, maxheight)];
end


function f = newFigure(widths, maxheight, varargin)
% Figure sized to a journal column width, white, ready to print at that size.
    if isempty(varargin), varargin = {'single'}; end
    wh = figSize(varargin{1}, widths, maxheight, varargin{2:end});
    f = figure('Color','w', 'Units','inches', 'Position',[1 1 wh(1) wh(2)], ...
               'PaperUnits','inches', 'PaperSize', wh, ...
               'PaperPosition',[0 0 wh(1) wh(2)], ...
               'PaperPositionMode','manual', ...   % keep the exact column width on export
               'InvertHardcopy','off');
end


function t = panelLabel(ax, txt, font, ink, dx, dy)
% Panel tag (A, B, C) above and left of the axes, 10 pt bold.
%
% dx and dy are offsets in normalized AXES units. They are converted to figure
% units and clamped to the page, because MATLAB's default subplot sits about 0.13
% from the left edge and an un-clamped tag lands off the canvas and is silently
% cropped on export. The position is read at call time, so call this after
% S.apply(ax) and after any tiledlayout or subplot repositioning.
    if nargin < 5 || isempty(dx), dx = -0.16; end
    if nargin < 6 || isempty(dy), dy =  1.02; end
    old = get(ax, 'Units'); set(ax, 'Units', 'normalized');
    p = get(ax, 'Position'); set(ax, 'Units', old);
    fx = max(p(1) + dx * p(3), 0.005);          % clamp to the page
    fy = min(p(2) + dy * p(4), 0.985);
    t = annotation(ancestor(ax, 'figure'), 'textbox', [fx fy 0.02 0.02], ...
                   'String', txt, 'FontName', font, 'FontSize', 10, ...
                   'FontWeight', 'bold', 'Color', ink, 'EdgeColor', 'none', ...
                   'FitBoxToText', 'on', 'Margin', 0, ...
                   'HorizontalAlignment', 'left', 'VerticalAlignment', 'bottom');
end


function applyAxis(ax, order, ink, font, tickpt, labelpt, titlept, titleweight, ticklen)
    set(ax, 'Box','off', ...              % no mirrored top/right rulers
            'ColorOrder', order, ...      % house palette for later plot calls
            'LineStyleOrder', '-', ...    % never cycle dash patterns onto series
            'TickDir','out', ...
            'TickLength',[ticklen ticklen], ...
            'XGrid','off','YGrid','off', ...
            'Color','w', ...
            'XColor',ink,'YColor',ink, ...
            'LineWidth',0.8, ...          % rulers and ticks below the data weight
            'FontName',font, ...
            'FontSize',tickpt, ...
            'Layer','top');
    ax.XLabel.FontSize = labelpt;  ax.XLabel.Color = ink;
    ax.YLabel.FontSize = labelpt;  ax.YLabel.Color = ink;
    ax.Title.FontSize  = titlept;  ax.Title.Color  = ink;
    ax.Title.FontWeight = titleweight;
end


function saveFig(fig, name, dpi, outdir)
% Vector PDF + raster PNG at the preset's dpi, white background, editable text.
%
% PDF and PNG only. SVG was dropped from the house style on 2026-09-04: the PDF
% already carries editable vector text for a copy editor, and a third file per
% figure only multiplies what has to be kept in step.
%
% Uses print, not exportgraphics: exportgraphics crops to the drawn content, so a
% figure built at 89 mm comes back narrower than 89 mm and the type no longer sits
% at the pt size it was set to. print honours PaperPosition, so the file keeps the
% column width .figure() asked for. Pair it with PaperPositionMode 'manual'.
    if nargin < 4 || isempty(outdir), outdir = 'figures'; end
    % Accept both char and string. print() reads a string filename as a graphics
    % handle and stops with "Invalid graphics object", so coerce to char first.
    % S.save(f, "fig1") is natural in modern MATLAB.
    name   = textArg(name,   'name');
    outdir = textArg(outdir, 'outdir');
    if ~exist(outdir, 'dir'), mkdir(outdir); end
    base = fullfile(outdir, name);
    set(fig, 'PaperPositionMode', 'manual');
    print(fig, [base '.pdf'], '-dpdf', '-painters');           % vector, editable text
    print(fig, [base '.png'], '-dpng', sprintf('-r%d', dpi));
end


function f = pickFont(candidates)
    try
        avail = listfonts;
    catch
        f = 'Helvetica'; return;
    end
    for k = 1:numel(candidates)
        if any(strcmpi(avail, candidates{k})), f = candidates{k}; return; end
    end
    f = 'Helvetica';
end


function s = textArg(v, what)
% One piece of text as char, from either a char row or a string scalar.
% Guards the common slip of building a name with []: ['fig_' "a"] converts the char
% to string and returns the 1x2 ARRAY ["fig_" "a"], not "fig_a". Use "fig_" + a or
% strcat('fig_', a) to join text.
    if isstring(v)
        if ~isscalar(v)
            error('daleyStyle:textArg', ...
                  ['%s must be one piece of text, got a %s string array. ' ...
                   'Joining text with [] builds an array: use "a" + b or strcat.'], ...
                  what, mat2str(size(v)));
        end
        s = char(v);
    elseif ischar(v)
        if size(v, 1) > 1
            error('daleyStyle:textArg', ...
                  '%s must be one row of text, got a %d-row char array.', ...
                  what, size(v, 1));
        end
        s = v;
    else
        error('daleyStyle:textArg', '%s must be char or string, got %s.', what, class(v));
    end
end
