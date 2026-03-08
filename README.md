# 🎯 EDGELAB — Guide de déploiement

## Structure du projet
```
edgelab/
├── public/
│   └── index.html
├── src/
│   ├── App.js              ← Dashboard principal
│   ├── index.js            ← Point d'entrée
│   ├── hooks/
│   │   └── useDashboardData.js  ← Chargement des données
│   └── utils/
│       └── api.js          ← Appels APIs + calculs
├── .env                    ← Tes clés API (JAMAIS publier)
├── .env.example            ← Modèle sans les vraies clés
├── .gitignore              ← Protège le .env
└── package.json
```

---

## 🚀 Déploiement en 5 étapes

### Étape 1 — Installe Node.js
👉 Va sur https://nodejs.org → télécharge la version LTS → installe

### Étape 2 — Ouvre un terminal
- **Windows** : clique droit sur le bureau → "Ouvrir dans le terminal"
- **Mac** : Cmd + Espace → tape "Terminal"

### Étape 3 — Installe et lance le projet
```bash
cd edgelab
npm install
npm start
```
→ Ton dashboard s'ouvre automatiquement sur http://localhost:3000

### Étape 4 — Crée un repo GitHub
1. Va sur github.com → "New repository"
2. Nomme-le "edgelab"
3. Clique "Create repository"
4. Tape dans le terminal :
```bash
git init
git add .
git commit -m "EdgeLab v1"
git remote add origin https://github.com/TON_USERNAME/edgelab.git
git push -u origin main
```

### Étape 5 — Déploie sur Vercel
1. Va sur vercel.com → "New Project"
2. Importe ton repo GitHub "edgelab"
3. Dans "Environment Variables", ajoute tes 4 clés :
   - REACT_APP_ODDS_API_KEY
   - REACT_APP_API_SPORTS_KEY
   - REACT_APP_RAPIDAPI_KEY
   - REACT_APP_BALLDONTLIE_KEY
4. Clique "Deploy"
5. Ton dashboard est en ligne ! Tu reçois une URL du type : https://edgelab-xxx.vercel.app

---

## 📱 Ajouter sur ton téléphone comme une app

### iPhone
1. Ouvre l'URL Vercel dans Safari
2. Clique sur le bouton "Partager" (carré avec flèche)
3. "Sur l'écran d'accueil"
4. C'est une vraie app maintenant !

### Android
1. Ouvre l'URL dans Chrome
2. Menu (3 points) → "Ajouter à l'écran d'accueil"

---

## ⚠️ IMPORTANT - Sécurité des clés API

Le fichier `.env` contient tes clés API. Il est dans le `.gitignore` donc
il ne sera JAMAIS publié sur GitHub.

Sur Vercel, tu les ajoutes manuellement dans les "Environment Variables"
— elles sont chiffrées et sécurisées.

---

## APIs utilisées
- **The Odds API** → Cotes Winamax en temps réel
- **API-Sports** → Stats football (xG, forme, blessures)
- **SofaScore (RapidAPI)** → Matchs tennis + basket live
- **BallDontLie** → Stats NBA détaillées
