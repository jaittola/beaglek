#!/usr/bin/env python

import RPi.GPIO as GPIO
import os

GPIO.setmode(GPIO.BOARD)
GPIO.setup(16, GPIO.IN, pull_up_down = GPIO.PUD_DOWN)

GPIO.wait_for_edge(16, GPIO.FALLING)
print("Button Pressed")
os.execv("/sbin/shutdown", ["/sbin/shutdown", "-h", "now" ])

GPIO.cleanup()
