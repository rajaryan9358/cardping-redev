# Hostinger VPS: first-time setup

One-time provisioning for a bare Hostinger VPS, before GitHub Actions can deploy to it. Hostinger
VPS plans are just a KVM Ubuntu box with root access via their hPanel — everything below is
standard Ubuntu server setup, plus the two Hostinger-specific steps called out inline.

## 1. Get access

In hPanel → **VPS → [your VPS] → Overview**, you'll find the server's IP address and a root
password (or you can upload your own SSH public key there before first boot — do that if given
the option, it saves a step). SSH in:

```bash
ssh root@YOUR_VPS_IP
```

If your domain isn't already pointed at this VPS, do that now in hPanel → **Domains → DNS Zone
Editor** (or wherever your domain's DNS is managed): an `A` record for your subdomain (e.g.
`cardping.example.com`) pointing at the VPS IP. This can take a few minutes to a few hours to
propagate — kick it off early since you'll need it for TLS later.

## 2. Update the box and create a deploy user

Don't run the app (or GitHub Actions) as root.

```bash
apt update && apt upgrade -y

adduser deploy
usermod -aG sudo deploy
```

Copy your SSH public key to the new user so you can log in as `deploy` directly:

```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

From now on, SSH in as `ssh deploy@YOUR_VPS_IP` instead of root.

## 3. Firewall

Hostinger also has a panel-level firewall (hPanel → **VPS → Firewall**) — if you enable it there,
make sure SSH (22), HTTP (80), and HTTPS (443) are allowed, in addition to the in-VPS firewall
below.

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 4. Install Node.js 20 and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2
node -v   # should print v20.x
```

## 5. Clone the repo

```bash
sudo mkdir -p /var/www/cardping
sudo chown deploy:deploy /var/www/cardping
git clone https://github.com/rajaryan9358/cardping-redev.git /var/www/cardping
cd /var/www/cardping/server
npm ci
```

`/var/www/cardping` is the path you'll put in the `VPS_DEPLOY_PATH` GitHub secret — see
[CI_CD.md](./CI_CD.md).

## 6. Configure and apply the database schema

```bash
cp .env.example .env
nano .env   # fill in every value — see docs/ENVIRONMENT.md
```

Apply `server/db/schema.sql` to your Supabase project — see [DATABASE.md](./DATABASE.md).
`server/.env` never gets committed or deployed by git; it lives only on this VPS (and your local
machine), edited by hand.

## 7. First manual start

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # prints a systemd command — copy/paste and run it as printed,
              # so PM2 (and this app) survives a VPS reboot
```

Confirm it's up: `curl http://localhost:3000/health` should return `{"ok":true,...}`.

## 8. nginx reverse proxy + TLS

Both apps in this repo share one domain and one nginx host: `server/` (Express, port 3000)
answers the webhook/OAuth paths that are registered with WhatsApp/Telegram/Google/Cashfree, and
`dashboard/` (Next.js, port 3100) answers everything else. Route by exact path, not by prefix —
the five backend paths below are the *complete* list (grep `server/src/routes/*.ts` for
`router.(get|post)` if that ever changes), so anything not matching one of them falls through to
the dashboard.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/cardping`:

```nginx
server {
    listen 80;
    server_name cardping.example.com;

    location = /health { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
    location = /webhooks/whatsapp { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
    location = /webhooks/telegram { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
    location = /webhooks/cashfree { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
    location = /oauth/google/callback { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cardping /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cardpingv2.rankkking.com
```

Confirm: `https://cardping.example.com/health` from your own machine (backend), and that the bare
domain loads the dashboard's `/login` page.

### Deploying the dashboard onto a server already provisioned for the backend only

If steps 1–7 were done before `dashboard/` existed in this repo, retrofit it without repeating
the whole walkthrough:

```bash
cd /var/www/cardping/dashboard
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Then update the nginx config to the split-routing version above (`sudo nginx -t && sudo systemctl
reload nginx` after editing) — `deploy.yml` only re-runs `npm ci && npm run build` and
`pm2 startOrReload` on every push to `main`; it doesn't touch nginx, so this one-time routing
change has to be made by hand.

## 9. Register the webhooks

Now that the app is reachable over HTTPS, finish the setup in
[SETUP.md](./SETUP.md#6-register-the-webhooks) — WhatsApp (Meta Dashboard), Telegram
(`npm run register:telegram-webhook`, run from `/var/www/cardping/server`), Google OAuth redirect
URI, Cashfree webhook.

## 10. Set up the GitHub Actions deploy key

`deploy.yml` needs to SSH into the VPS with no human present to type a password or approve
anything — so it authenticates with an SSH **key pair** instead: GitHub Actions holds the private
half (as a secret), the VPS's `deploy` user trusts the public half (in its `authorized_keys`).
This step creates that key pair and wires the two ends together.

### Why a *dedicated* key, not your personal one

Don't reuse the SSH key you personally log into the VPS with. A key pasted into a GitHub secret
is only as safe as everyone who can read repo secrets (repo admins, and any workflow run that
prints it by accident) — if it's a throwaway key that only grants `deploy`-user access to one
VPS, that's a contained, easily-rotated blast radius. If it's your personal key, it might also
unlock other servers, other accounts, or be protected by a passphrase you rely on elsewhere. A
purpose-built key costs nothing extra and you can revoke it in ten seconds (see
[Rotating or revoking it](#rotating-or-revoking-it) below) without touching your own access.

### Step 1 — generate the key pair

Run this on your **local machine** (not the VPS — you need to copy the public half *to* the VPS
and the private half *to* GitHub, so it's easiest to generate somewhere you can reach both):

```bash
ssh-keygen -t ed25519 -f ~/cardping_deploy_key -C "github-actions-deploy" -N ""
```

- `-t ed25519` — a modern, short, fast key type. There's no reason to use the older `rsa` type for
  a new key.
- `-f ~/cardping_deploy_key` — where to write it. Produces two files: `~/cardping_deploy_key`
  (the **private** key — never share this except by pasting it into the GitHub secret) and
  `~/cardping_deploy_key.pub` (the **public** key — safe to share, this is what goes on the VPS).
- `-C "github-actions-deploy"` — just a label (a comment) embedded in the public key so that, a
  year from now, `cat authorized_keys` tells you *what this key is for* instead of being an
  anonymous blob.
- `-N ""` — **no passphrase**. This is deliberate, not an oversight: a passphrase means something
  has to type it in on every use, and there's no human at the keyboard when GitHub Actions runs.
  The trade-off (an unencrypted private key sitting in GitHub's secret store) is why this must be
  a dedicated, narrowly-scoped key rather than one that opens more than this one deploy path —
  see the section above.

### Step 2 — authorize it on the VPS

Copy the **public** key into the `deploy` user's `~/.ssh/authorized_keys`:

```bash
ssh-copy-id -i ~/cardping_deploy_key.pub deploy@YOUR_VPS_IP
```

(On macOS, if `ssh-copy-id` isn't installed: `brew install ssh-copy-id`. Or do it by hand:
`cat ~/cardping_deploy_key.pub | ssh deploy@YOUR_VPS_IP "cat >> ~/.ssh/authorized_keys"`.)

This appends the key — it doesn't replace your existing access, so your personal key still works
too. `authorized_keys` can hold as many keys as you like, one per line.

### Step 3 — prove it works, *before* handing it to CI

```bash
ssh -i ~/cardping_deploy_key deploy@YOUR_VPS_IP "echo it works"
```

If you don't see `it works`, stop here and fix it — pasting a broken key into GitHub and
debugging it through Actions logs is much slower than debugging it locally. Common causes:
wrong `YOUR_VPS_IP`, `ssh-copy-id` targeted the wrong user, or `~/.ssh` on the VPS has overly
permissive file modes (SSH silently refuses to use an `authorized_keys` file that's
group/world-writable — `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys` on the VPS fixes
that).

### Step 4 — add the private key as a GitHub secret

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**.

- Name: `VPS_SSH_KEY`
- Value: the **entire contents** of the private key file, header and footer included:

  ```bash
  cat ~/cardping_deploy_key
  ```

  Paste everything from `-----BEGIN OPENSSH PRIVATE KEY-----` to
  `-----END OPENSSH PRIVATE KEY-----` inclusive. A partial paste (e.g. missing the last line) is
  the single most common reason this step fails later — the key will just look like garbage to
  SSH and every deploy will fail at the "SSH and deploy" step with an auth error.

Add the other four secrets (`VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_DEPLOY_PATH`) the same way —
see [CI_CD.md](./CI_CD.md#required-github-secrets) for what each one is.

### Step 5 — clean up the local copy

```bash
rm ~/cardping_deploy_key ~/cardping_deploy_key.pub
```

Once it's pasted into GitHub, there's no further need for it to sit on your laptop. (If you ever
need it again, generating a fresh key and repeating this section is simpler than trying to
recover an old one — GitHub secrets are write-only, you can't read a secret's value back out
after saving it.)

### A note on host key checking

Normally, the *first* time you SSH to a new host, you get prompted to confirm its fingerprint
("Are you sure you want to continue connecting?") — that prompt has no one to answer it inside a
GitHub Actions runner. `appleboy/ssh-action` (what `deploy.yml` uses) handles this for you by not
enforcing strict host key checking by default, so you won't hit that prompt/failure in CI. This is
a reasonable default for deploying to a server you control by IP, and matches what the manual
`ssh -i ...` test in Step 3 does the first time too (it'll ask you to confirm once, interactively,
which the CI's connection never has to).

### Rotating or revoking it

Because this key only exists in one place on the VPS (one line in `deploy`'s
`~/.ssh/authorized_keys`) and one place in GitHub (the `VPS_SSH_KEY` secret), shutting off CI's
access — without touching your own — is:

```bash
# on the VPS, as deploy or root:
nano ~/.ssh/authorized_keys   # delete the "github-actions-deploy" line, save
```

Do that any time you suspect the key leaked, or just periodically as good hygiene. To rotate to a
fresh key instead of only revoking, repeat Steps 1–4 with a new filename and update the
`VPS_SSH_KEY` secret to the new private key before removing the old public key from
`authorized_keys` — that ordering avoids a window where neither key works.

---

From here on, every push to `main` deploys automatically. See [CI_CD.md](./CI_CD.md) for how that
works and how to roll back if a deploy goes wrong.
