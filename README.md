# abhay-kumar — personal site

"The Annual Report": a personal portfolio for Abhay Kumar (Penn State — B.S. Finance & B.S. Economics).

Static site — plain HTML, CSS and JavaScript, no build step. Deployed with GitHub Pages.

## Structure
| Path | Chapter |
|---|---|
| `index.html` | 01 Index |
| `work/index.html` | 02 Selected Work |
| `work/sentiment.html` | 02.1 Reading the News (case study) |
| `work/agents.html` | 02.2 Agents at Market (case study) |
| `record.html` | 03 The Record |
| `about.html` | 04 About & Contact |

Shared system: `assets/css/base.css` (tokens, type, primitives) and `assets/js/site.js`
(header, footer, "next chapter" links, page-transition curtain, scroll scenes). Each page adds its own CSS/JS.

## Run locally
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000.

## Updating content
- Résumé PDF: replace `assets/docs/Abhay_Kumar_Resume.pdf`.
- LinkedIn URL: `LINKEDIN` in `assets/js/site.js` and the contact link in `about.html`.
- Portrait: add `assets/img/portrait.jpg` and swap the placeholder in `about.html`.
