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

## Ce îți trebuie (Windows)
- **Claude Code**
- **Node.js 20+**: `winget install OpenJS.NodeJS.LTS`
- **ffmpeg**: `winget install Gyan.FFmpeg`
- **Python 3.10+**: `winget install Python.Python.3.11`
- **Git**: `winget install Git.Git`
- **Google Chrome** sau **Microsoft Edge** (Edge e deja instalat pe Windows)
- Recomandat: o placă video **NVIDIA**. Merge și fără, dar mai încet.

După instalare, deschide un terminal **nou**.

## Instalare
Skill-ul stă în proiectul tău, în `.claude\skills\vibe-nimation`:

```bash
git clone https://github.com/<contul-tau>/vibe-nimation-skill.git "D:\Vibe-nimation\.claude\skills\vibe-nimation"
```

```bash
python "D:\Vibe-nimation\.claude\skills\vibe-nimation\scripts\setup.py" --root "D:\Vibe-nimation"
```

Setup-ul verifică uneltele, instalează mediul Python privat și modelele (~4 GB, o singură dată), testează placa
video și generează o replică de test cu vocea naratorului. Rulează-l până scrie **All set**.

Pe alt calculator, fără `--root`, folderul implicit e `C:\Users\<nume>\Vibe-nimation`.

## Folosire
Deschide Claude Code în `D:\Vibe-nimation` și scrie, de exemplu:

> Fă short-uri din episodul D:\Seriale\Stranger.Things.S01E01.mkv

Claude analizează episodul și se oprește ca să-ți arate serialul detectat, fișele personajelor și lista de
short-uri propuse, fiecare cu notă. După ce aprobi, le face pe rând.

## Unde ajung fișierele
```
D:\Vibe-nimation\
├── Vibe-nimation episodes\
│   ├── _Personaje\<Serial>\                fișele personajelor (refolosite la toate episoadele)
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
