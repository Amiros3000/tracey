#!/bin/bash
# deploy.sh — push backend code + sync missing env keys to Hetzner, then restart

set -e

HOST="amir@5.161.70.14"
SSH="ssh -i ~/.ssh/id_ed25519"
REMOTE_DIR="/home/amir/backend"
LOCAL_ENV="./backend/.env"

echo "→ Syncing code..."
rsync -az --exclude='venv' --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='.env' --exclude='tracey.db' \
  -e "ssh -i ~/.ssh/id_ed25519" \
  ./backend/ $HOST:$REMOTE_DIR/

echo "→ Syncing missing env keys..."
while IFS= read -r line; do
  # Skip blanks and comments
  [[ -z "$line" || "$line" == \#* ]] && continue
  KEY="${line%%=*}"
  # Add to server only if key is not already present
  $SSH $HOST "grep -q '^${KEY}=' $REMOTE_DIR/.env 2>/dev/null || echo '$line' >> $REMOTE_DIR/.env"
done < "$LOCAL_ENV"

echo "→ Installing dependencies..."
$SSH $HOST "cd $REMOTE_DIR && source venv/bin/activate && pip install -r requirements.txt -q"

echo "→ Restarting backend..."
$SSH $HOST "pm2 restart tracey-api --update-env"

echo "✓ Deploy complete"
