#!/usr/bin/env bash
# Paperclip reference server — requires /tmp/paperclip to exist
if [ ! -d "/tmp/paperclip" ]; then
  echo "Paperclip not found at /tmp/paperclip. Clone it first:"
  echo "  git clone <paperclip-repo> /tmp/paperclip && cd /tmp/paperclip && pnpm install"
  exit 1
fi
cd /tmp/paperclip
PORT=3200 pnpm dev:once
