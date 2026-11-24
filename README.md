# Vibe-nimation

Skill pentru Claude Code: îi dai un episod dintr-un serial (fișier video de 20–40 de minute), iar Claude îl analizează,
recunoaște serialul, episodul și personajele, îți propune un plan de short-uri și, după ce îl aprobi, face
short-uri animate 9:16 pentru TikTok și YouTube Shorts:

- animație **2D vectorială**, stil comic, personaje cu **rigging de tip puppet**, cameră **2.5D cu parallax**,
  totul desenat din cod;
- **narator** cu voce groasă și expresivă (Chatterbox, local), iar personajele **mimează** replicile;
- **muzică originală** fără drepturi, potrivită atmosferei, plus efecte sonore;
- **subtitrări arse** în video, cuvânt cu cuvânt;
- pentru fiecare short, un **.txt** cu titlu, descriere, hashtag-uri și notă virală de la 1 la 10.

Totul rulează **local și gratuit**: fără API-uri, abonamente sau credite.

## Instalare (Windows) — o singură comandă
Deschide **PowerShell** (Start → scrie „PowerShell” → Enter) și lipește:

```bash
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/toma-hue/vibe-nimation-skill/main/install.ps1 | iex"
```

Scriptul instalează ce lipsește (Node.js, ffmpeg, Python 3.11, Git), creează proiectul `D:\Vibe-nimation` (sau
`C:\Users\<nume>\Vibe-nimation` dacă nu ai partiția D:), cu folderul `Episoade\`, pune skill-ul în
`.claude\skills\vibe-nimation` și rulează setup-ul (~4 GB de modele, o singură dată). Dacă îți cere să deschizi un
PowerShell nou, fă-o și lipește aceeași comandă: continuă de unde a rămas. Recomandat: placă video NVIDIA.

Pentru Mac/Linux sau instalare manuală: Node.js 20+, ffmpeg, Python 3.10+, Git, apoi:

```bash
git clone https://github.com/toma-hue/vibe-nimation-skill.git ~/Vibe-nimation/.claude/skills/vibe-nimation
```

```bash
python3 ~/Vibe-nimation/.claude/skills/vibe-nimation/scripts/setup.py --root ~/Vibe-nimation
```

## Folosire
Pune episodul în `D:\Vibe-nimation\Episoade\`, deschide Claude Code în `D:\Vibe-nimation` și scrie, de exemplu:

> Folosește vibe-nimation pe episodul D:\Vibe-nimation\Episoade\Stranger.Things.S01E01.mkv

Claude analizează episodul și se oprește ca să-ți arate serialul detectat, fișele personajelor și lista de
short-uri propuse, fiecare cu notă. După ce aprobi, le face pe rând.

## Consum de credite Claude Code
Doar conversația cu Claude consumă credite (vocea, randarea, muzica rulează local, gratuit). Recomandări: sesiunea
principală pe **Sonnet** (`/model sonnet`); Opus doar pentru analiza narativă și reparațiile de rig, lansate de skill ca
sub-agenți; câte 2–3 short-uri per sesiune nouă (starea e în `bible.md`). Ca să vezi unde s-au dus creditele:

```bash
python scripts/usage_report.py
```

## Unde ajung fișierele
```
D:\Vibe-nimation\
├── Vibe-nimation episodes\
│   ├── _Personaje\<Serial>\                fișele personajelor + verificări (refolosite la toate episoadele)
│   ├── _Locatii\<Serial>\                  locațiile refăcute vectorial + fișele lor (refolosite)
│   └── <Serial> - S01E01\
│       ├── S01E01 - Short 01 - <Titlu>.mp4
│       └── S01E01 - Short 01 - <Titlu>.txt
└── _lucru\                                 fișiere temporare (se pot șterge după)
```

## Opțional: muzică generată cu AI
```bash
python scripts/music_ai_setup.py
```
Are nevoie de ~15 GB pe disc și de placă NVIDIA. Fără ea, muzica e generată din cod și merge mereu.
