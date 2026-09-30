# Deploy Lunara to Vercel + Railway

## Current state

The application is built and locally tested. Source is published to [johanstevenz1/lunara-music-app](https://github.com/johanstevenz1/lunara-music-app). The user explicitly deferred Vercel and Railway deployment until later. No public application URL, paid service or production deployment has been created. Existing Auralis projects must not be selected or modified.

## 1. GitHub

The independent public repository is already created and contains the project root and lockfile. Clone it for further development. The `.gitignore` excludes tokens/environment files, dependencies and compiled output. Do not reuse an Auralis repository.

```sh
git clone https://github.com/johanstevenz1/lunara-music-app.git
cd lunara-music-app
```

Use your normal authenticated Git/GitHub workflow to publish subsequent changes. Do not paste tokens into README files or shell history.

## 2. Create the Vercel frontend project

Import the new GitHub repository as a new **Lunara** project. Select Vite; the project root is the repository root. Settings:

- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- Public variable: `VITE_SPOTIFY_CLIENT_ID=063552a8b317485b922392717dc4159e`

Obtain the stable Vercel domain. The first frontend deployment can render before the API exists; Spotify profile/search/playback are not ready until both services are configured. This intermediate state is not the final product.

## 3. Deploy Railway API

Create a new project/service named **Lunara API** from the same repository. Do not select an existing Auralis service. Railway uses the included Dockerfile and `railway.json`.

Variables:

```dotenv
SPOTIFY_CLIENT_ID=063552a8b317485b922392717dc4159e
FRONTEND_ORIGIN=https://YOUR-STABLE-VERCEL-DOMAIN
NODE_ENV=production
```

Let Railway inject `PORT`, or set it to 3001 and configure the public service port accordingly. Generate a Railway HTTPS domain after the service is healthy. Verify:

```text
https://YOUR-API.up.railway.app/api/health
```

Expected JSON: `{"status":"ok"}`. Public `/api/config` exposes only the public Client ID. Other API endpoints require the user's Bearer token.

Use an existing eligible plan/trial. Any new subscription or payment needs the account owner's action.

## 4. Connect frontend to backend

Add this Vercel Production environment variable and redeploy:

```dotenv
VITE_API_URL=https://YOUR-API.up.railway.app
```

Do not include a trailing slash. `FRONTEND_ORIGIN` must exactly equal the Vercel page origin. If the Vercel domain changes, update Railway's origin and Spotify's callback registration too. Preview deployment domains are separate origins and are not automatically permitted.

Vite substitutes `VITE_` variables at build time, so changing them requires redeployment. References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles).

## 5. Spotify Developer Dashboard

Register the production redirect exactly:

```text
https://YOUR-STABLE-VERCEL-DOMAIN/callback
```

Also register the development callback separately if required:

```text
http://127.0.0.1:43730/callback
```

The app derives its redirect from the current frontend origin; it never redirects a production user to the developer's computer. Confirm Web API + Web Playback SDK selection and allowlisted Premium test users. PKCE does not require a Client Secret.

## 6. Required production verification

From a clean browser on the public HTTPS URL:

1. Confirm the page and `/callback` route load.
2. Connect Spotify and verify the profile and **Player ready** status.
3. Search two arbitrary songs; confirm real metadata and cover images.
4. Play each song and verify audible audio from Lunara's Spotify device.
5. Test pause/resume, seek, volume and mute.
6. Insert at start/end/position, then test next/previous while Developer View is open.
7. Check automatic next, repeat-off/current/playlist, shuffle history and queue changes.
8. Delete the current song, delete the only song, and test the empty playlist.
9. Test a local MP3 and switching between Spotify/local audio.
10. Check mobile layout and browser console; reload and verify library persistence.

Update README's production/repository URLs and `QA.md` with verified results only after these checks pass.
