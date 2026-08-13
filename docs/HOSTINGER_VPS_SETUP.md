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
git clone https://github.com/<you>/<your-repo>.git /var/www/cardping
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

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/cardping`:

```nginx
server {
    listen 80;
    server_name cardping.example.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cardping /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cardping.example.com
```

Confirm: `https://cardping.example.com/health` from your own machine.

## 9. Register the webhooks

Now that the app is reachable over HTTPS, finish the setup in
[SETUP.md](./SETUP.md#6-register-the-webhooks) — WhatsApp (Meta Dashboard), Telegram
(`npm run register:telegram-webhook`, run from `/var/www/cardping/server`), Google OAuth redirect
URI, Cashfree webhook.

## 10. Set up the GitHub Actions deploy key

Generate a dedicated SSH key pair **for CI to use** (don't reuse your personal key):

```bash
ssh-keygen -t ed25519 -f ~/cardping_deploy_key -C "github-actions-deploy" -N ""
```

This prints two files: `cardping_deploy_key` (private) and `cardping_deploy_key.pub` (public).

Add the **public** key to the VPS's `deploy` user:

```bash
ssh-copy-id -i ~/cardping_deploy_key.pub deploy@YOUR_VPS_IP
```

Add the **private** key's contents as the `VPS_SSH_KEY` GitHub secret — see
[CI_CD.md](./CI_CD.md) for the full list of secrets and where to add them. Then delete the local
copy of the private key (`rm ~/cardping_deploy_key`) once it's in GitHub — you don't need it lying
around afterward.

From here on, every push to `main` deploys automatically. See [CI_CD.md](./CI_CD.md) for how that
works and how to roll back if a deploy goes wrong.
