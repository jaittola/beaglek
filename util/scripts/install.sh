#!/bin/bash

HOST=beagle.local

ssh ${HOST} "cd; mkdir bin statuspage >> /dev/null 2>&1"

scp run-kiosk.sh ${HOST}:bin/
scp statuspage.html.template ${HOST}:statuspage/index.html.template
