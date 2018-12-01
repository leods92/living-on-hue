# living-on-hue

This is a simple Wizard script to guide you through the configuration of Philips LivingColors lamps and remotes with Philips Hue bridges.

Because there were many details I had to pay attention to be able to accomplish that, I decided to write this script.

## Disclaimer

I give no warranty.
Use it at your own risk, if it damages your device it's your responsibility.

This uses `huejay` which is a node library that ultimately uses the HTTP API provided by the Philips Hue bridges.
So it should be safe to use.

## Tested environment

I've tested this with:
- a Philips Hue Bridge 2.0 (the square one)
- a Philips LivingColors Iris lamp 3rd generation (round remote with 1 rotation wheel, 2 scenario buttons and 1 on and 1 off button)

The outcome is that my LivingColors lamp can:
- be controlled via the hue bridge (and of course the hue app)
- be controlled via the remote it came with it

Test on Dec 1.

## How to install

Prerequisites:
- Node (js) (tested on Node 8)
- A terminal app (tested it on Terminal.app for macOS running zsh)

Download this repository into a file.

To install, in your favorite shell console:
- Change the directory to the repository
- Run `npm install`

## How to run

Run `npm start`.
