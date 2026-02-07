#!/bin/sh -ex

./scripts/publish_local.sh
rm -rf ~/code/chaaskit-test-6/
./scripts/create-test-project.sh chaaskit-test-6/
cd ~/code/chaaskit-test-6/
cp ../chaaskit-test-3/vite.config.ts ./vite.config.ts
cd ~/code/chat-saas-template/
