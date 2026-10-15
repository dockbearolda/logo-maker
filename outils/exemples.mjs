/* LES EXEMPLES DE L'ACCUEIL (15 octobre 2026) : trois fichiers de marques
   fictives, dessinés en SVG et rendus par un Chrome sans fenêtre, puis
   abîmés comme les fichiers des clients (réduits, en JPEG, un peu flous).
     node outils/exemples.mjs
   écrit exemples/carte-de-visite.jpg, fond-couleur.png, illustration.png.
   Playwright : celui de ~/.npm/_npx (pas de paquet dans ce dépôt). Les
   polices (Montserrat, Lora) viennent de Google, le temps du rendu : ce
   sont des familles de l'index (vendor/polices), que la reconnaissance
   retrouve. */
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
const { chromium } = await import(join(homedir(), '.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs'))

const POLICE = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@800&family=Lora:ital,wght@1,600&display=swap'
/* Un logo à plat de deux couleurs, son nom en Montserrat 800 : le cas du
   comptoir (une carte de visite photographiée, réduite, en JPEG). */
const CARTE = `<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="800" viewBox="0 0 1300 800">
  <rect width="1300" height="800" fill="#ffffff"/>
  <circle cx="330" cy="400" r="190" fill="#0f3b5f"/>
  <path d="M330 250 L470 400 L330 550 L190 400 Z" fill="#f2a900"/>
  <text x="560" y="372" font-family="Montserrat" font-weight="800" font-size="150" fill="#0f3b5f">NORDIK</text>
  <text x="564" y="500" font-family="Montserrat" font-weight="800" font-size="78" letter-spacing="14" fill="#f2a900">PLOMBERIE</text>
</svg>`
/* Un logo sur un fond uni coloré, des lettres à creux : « Fond retiré · partout ». */
const FOND = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000" fill="#2d8a5e"/>
  <circle cx="500" cy="400" r="230" fill="none" stroke="#ffffff" stroke-width="34"/>
  <text x="500" y="455" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="150" fill="#ffffff">BOA</text>
  <text x="500" y="780" text-anchor="middle" font-family="Lora" font-style="italic" font-weight="600" font-size="96" fill="#ffffff">Boulangerie</text>
</svg>`
/* Une illustration à dégradés : la version Image. */
const ILLU = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5e62"/></linearGradient>
    <radialGradient id="soleil"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1000" height="1000" fill="#ffffff"/>
  <circle cx="500" cy="460" r="330" fill="url(#ciel)"/>
  <circle cx="500" cy="380" r="170" fill="url(#soleil)"/>
  <path d="M170 560 Q330 420 500 560 T830 560 L830 790 L170 790 Z" fill="#1d3557"/>
  <path d="M170 650 Q330 540 500 650 T830 650 L830 790 L170 790 Z" fill="#457b9d"/>
  <text x="500" y="920" text-anchor="middle" font-family="Lora" font-style="italic" font-weight="600" font-size="84" fill="#1d3557">Rivage Studio</text>
</svg>`

const navigateur = await chromium.launch({ channel: 'chrome', headless: true })
const page = await navigateur.newPage()
/* Le SVG posé dans la page (ses polices chargées par la feuille de Google),
   capturé par Chrome, puis réduit dans une toile (JPEG ou PNG), un léger
   flou pour la carte de visite. */
const rendre = async (svg, largeur, type, qualite, flou) => {
  await page.setContent('<!doctype html><link rel="stylesheet" href="' + POLICE + '"><style>body{margin:0;background:#fff}</style><div id="s">' + svg + '</div>')
  await page.evaluate(async () => { await document.fonts.ready; for (const f of ['800 20px Montserrat', 'italic 600 20px Lora']) await document.fonts.load(f) })
  const png = await page.locator('#s svg').screenshot({ type: 'png' })
  const data = await page.evaluate(async ({ png, largeur, type, qualite, flou }) => {
    const img = new Image()
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = 'data:image/png;base64,' + png })
    const toile = document.createElement('canvas')
    toile.width = largeur; toile.height = Math.round(img.height * largeur / img.width)
    const ctx = toile.getContext('2d')
    /* Du blanc sous le dessin : sinon le flou se mélange au transparent de
       la toile, que le JPEG compose sur du noir — un bord gris que le
       graphiste prendrait pour le fond. */
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, toile.width, toile.height)
    ctx.imageSmoothingQuality = 'high'
    if (flou) ctx.filter = 'blur(' + flou + 'px)'
    ctx.drawImage(img, 0, 0, toile.width, toile.height)
    return toile.toDataURL(type, qualite)
  }, { png: png.toString('base64'), largeur, type, qualite, flou })
  return Buffer.from(data.split(',')[1], 'base64')
}
await mkdir('exemples', { recursive: true })
await writeFile('exemples/carte-de-visite.jpg', await rendre(CARTE, 420, 'image/jpeg', 0.6, 0.7))
await writeFile('exemples/fond-couleur.png', await rendre(FOND, 600, 'image/png', 1, 0))
await writeFile('exemples/illustration.png', await rendre(ILLU, 700, 'image/png', 1, 0))
await navigateur.close()
console.log('exemples/ écrits')
