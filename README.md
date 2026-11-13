# Matia Steiner · STPcs

Personal website for STPcs, custom PCs built by hand in Bern. Plain HTML, CSS and JavaScript, with no build step.

- `index.html`: the main page
- `builds.html`: every build with its full spec list
- `assets/`: shared styles and script for both pages
- `images/`: the build photos (and `founder.jpg`, the 720 × 1280 photo for the About section)

The site is in English and German. Every translated text carries `data-en` and `data-de` attributes; the script shows one of them, so when editing a text, change both attributes, not only the text between the tags.

## Publishing on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open Settings → Pages, set Source to "Deploy from a branch", pick `main` and `/ (root)`, and save.
3. After a minute the site is live at `https://<your-user>.github.io/<repository>/`.

## Contact form

Messages are sent through [Web3Forms](https://web3forms.com) to Matia's inbox. The access key goes into `data-key=""` on the `<form id="contact-form">` in `index.html`. Without a key, the form opens the visitor's email app instead.

## Editing locally

Run `python3 -m http.server 4321` in this folder and open http://127.0.0.1:4321/.
