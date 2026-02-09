<img width=275 align="right" src="./imgs/screenshot.png">

# TikZJax Enhanced

An enhanced Obsidian plugin for rendering LaTeX and TikZ diagrams in your notes. Forked from [obsidian-tikzjax](https://github.com/artisticat1/obsidian-tikzjax) v0.5.2 with significant improvements.

You can render graphs, figures, circuits, chemical diagrams, commutative diagrams, and more.

## What's new in Enhanced

- **Diagram UI**: Toolbar with export button, zoom controls, and cache indicator
- **Zoom**: Click diagram to toggle 1x/2x, or use toolbar buttons (50%–200%)
- **Export**: Download diagrams as SVG or PNG
- **Custom preamble**: Global `\usepackage`, `\newcommand`, `\usetikzlibrary` in settings
- **Per-block scale**: Add `% scale: 1.5` comment to scale individual diagrams
- **Alt text**: Add `% alt: description` for SVG accessibility
- **TTL cache**: Memory + persistent cache with configurable expiration
- **Error display**: Structured error messages with collapsible details
- **Dark mode**: Automatic color inversion for diagram visibility
- **Security fixes**: Safe SVG insertion via DOMParser (no innerHTML/outerHTML)

## Available packages

The following packages are available in `\usepackage{}`:
- chemfig
- tikz-cd
- circuitikz
- pgfplots
- array
- amsmath
  - amstext
- amsfonts
- amssymb
- tikz-3dplot

## Usage
Content inside of `tikz` code blocks will be rendered by TikZJax.

- Remember to load any packages you need with `\usepackage{}`, and include `\begin{document}` and `\end{document}`.
- The standalone document class is used (`\documentclass{standalone}`).

### Per-block options

Add special comments at the top of your tikz code block:

````latex
```tikz
% scale: 1.5
% alt: A plot of sine and cosine functions
\begin{document}
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
\end{document}
```
````

### Examples
<img width=300 align="right" src="./imgs/img1.png">

````latex
```tikz
\begin{document}
  \begin{tikzpicture}[domain=0:4]
    \draw[very thin,color=gray] (-0.1,-1.1) grid (3.9,3.9);
    \draw[->] (-0.2,0) -- (4.2,0) node[right] {$x$};
    \draw[->] (0,-1.2) -- (0,4.2) node[above] {$f(x)$};
    \draw[color=red]    plot (\x,\x)             node[right] {$f(x) =x$};
    \draw[color=blue]   plot (\x,{sin(\x r)})    node[right] {$f(x) = \sin x$};
    \draw[color=orange] plot (\x,{0.05*exp(\x)}) node[right] {$f(x) = \frac{1}{20} \mathrm e^x$};
  \end{tikzpicture}
\end{document}
```
````

<img width=325 align="right" src="./imgs/img2.png">

````latex
```tikz
\usepackage{circuitikz}
\begin{document}

\begin{circuitikz}[american, voltage shift=0.5]
\draw (0,0)
to[isource, l=$I_0$, v=$V_0$] (0,3)
to[short, -*, i=$I_0$] (2,3)
to[R=$R_1$, i>_=$i_1$] (2,0) -- (0,0);
\draw (2,3) -- (4,3)
to[R=$R_2$, i>_=$i_2$]
(4,0) to[short, -*] (2,0);
\end{circuitikz}

\end{document}
```
````

<img width=375 align="right" src="./imgs/img3.png">

````latex
```tikz
\usepackage{pgfplots}
\pgfplotsset{compat=1.16}

\begin{document}

\begin{tikzpicture}
\begin{axis}[colormap/viridis]
\addplot3[
	surf,
	samples=18,
	domain=-3:3
]
{exp(-x^2-y^2)*x};
\end{axis}
\end{tikzpicture}

\end{document}
```
````

<img width=400 align="right" src="./imgs/img4.png">

````latex
```tikz
\usepackage{tikz-cd}

\begin{document}
\begin{tikzcd}

    T
    \arrow[drr, bend left, "x"]
    \arrow[ddr, bend right, "y"]
    \arrow[dr, dotted, "{(x,y)}" description] & & \\
    K & X \times_Z Y \arrow[r, "p"] \arrow[d, "q"]
    & X \arrow[d, "f"] \\
    & Y \arrow[r, "g"]
    & Z

\end{tikzcd}

\end{document}
```
````

## Settings

Settings are organized into sections:

| Section | Options |
|---------|---------|
| **Appearance** | Invert dark colors in dark mode, default scale factor |
| **LaTeX** | Custom preamble |
| **Rendering** | Show error messages |
| **Cache** | Enable cache, TTL, cache indicator, clear cache |
| **Export** | Default format (SVG/PNG), PNG export scale |
| **Debug** | Debug mode |

## Acknowledgements

This plugin is a fork of [obsidian-tikzjax](https://github.com/artisticat1/obsidian-tikzjax) by [@artisticat1](https://github.com/artisticat1).

It would not be possible without [TikZJax](https://github.com/kisonecat/tikzjax) by [@kisonecat](https://github.com/kisonecat). In particular, it uses [@drgrice1's fork](https://github.com/drgrice1/tikzjax/tree/ww-modifications) that adds some additional features.

Design patterns (diagram UI, cache system, error handling) are inspired by [obsidian-tikz-advanced](https://github.com/deltazita/obsidian-tikz-advanced).

## License

MIT License. See [LICENSE.md](LICENSE.md) for details.
