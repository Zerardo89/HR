# Brief per ComfyUI — asset grafici

## Guida di stile (provvisoria, da confermare con Q12)
- **Sensazione:** calda, affidabile, di quartiere. Non "startup tech", non "corporate".
- **Palette proposta:** verde salvia (fiducia, territorio) + arancio tenue (energia, lavoro manuale) + neutri caldi. Contrasto AA garantito sul testo.
- **Illustrazioni:** piatte/semi-piatte, contorni morbidi, persone **stilizzate** e **diverse** (età, genere, origine, abilità), mestieri concreti (cucina, magazzino, cantiere, cura, negozio, campi, ufficio).
- **Da evitare:** fotorealismo di persone, testimonial finti, riferimenti a marchi (Indeed, LinkedIn…), testo dentro le immagini (lo aggiungiamo dopo in vettoriale).

## Modelli ammessi
- **FLUX.1 [schnell]** — licenza Apache 2.0 (uso commerciale ok).
- **SDXL** base/refiner — licenza OpenRAIL++-M (uso commerciale ok, rispettando le restrizioni d'uso).
- ❌ **FLUX.1 [dev]** senza licenza commerciale BFL.
- Eventuali LoRA: solo con licenza che permetta l'uso commerciale; annotare la fonte.

## Template di brief (uno per asset)

```text
ID: V-{{nn}}
Asset: {{es. icona app}}
Formati finali: {{es. 512x512 PNG, sfondo pieno; icona adattiva: primo piano 432x432 in area sicura 264x264}}
Soggetto: {{descrizione}}
Stile: guida di stile sopra
Prompt positivo: {{…}}
Prompt negativo: text, watermark, logo, photorealistic faces, brand names, blurry, low contrast
Modello / sampler / passi / CFG / seed: {{…}}
Varianti richieste: {{n}}
Consegna: design/{{cartella}}/ + workflow JSON in design/comfyui/
Note legali: nessuna persona reale riconoscibile; nessun marchio altrui
```

## Specifiche Play Store (promemoria)
- Icona: 512×512 PNG 32-bit.
- Feature graphic: 1024×500 JPG o PNG 24-bit, niente trasparenza.
- Screenshot telefono: da 2 a 8, lato corto ≥ 320 px, proporzioni fino a 2:1.
- Icone PWA: 192×192 e 512×512 + versione `maskable` con area sicura.
