const huejay = require('huejay')

const config = {
  offline: true,
  authenticationWaitingTime: 60 * 1000,
  authenticationAttemptInterval: 1000,
  lightScanWaitingTime: 30 * 1000,

  // In case you want to skip bridge lookup
  // bridgeHost: '',

  // In case you want to reuse a bridge user
  // username: ''
}
let client

function exitWithError(...errorMessages) {
  if (!errorMessages.length) {
    errorMessages.push(
      `Please restart this script and follow *all* the steps to be safe.`
    )
  }

  errorMessages.push('Aborting...')
  console.error(...errorMessages)
  process.exit(1)
}

// This function is just for debugging purposes
async function getLastExistentLight() {
  const lights = await client.lights.getAll()
  const light = lights[lights.length - 1]

  console.log(`Using light "${light.name}"`)

  return light
}

function waitForUserInput() {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.resume();
      resolve()
    });
  })
}

function discoverBridge () {
  if (config.bridgeHost) {
    return Promise.resolve({ ip: config.bridgeHost })
  }

  console.info('Looking for bridges...')

  return huejay.discover({
    strategy: config.offline ? 'upnp' : 'all'
  })
    .then(bridges => {
      if (!bridges.length) {
        exitWithError('No bridges discovered, try again.')
      }

      if (bridges.length > 1) {
        exitWithError('Multiple bridges discovered.')
      }

      return bridges[0]
    })
    .catch(error => console.error('Failed to discover a bridge; error: ', message))
}

function initClient(bridge) {
  client = new huejay.Client({
    host: bridge.ip,
    username: config.username
  })
}

function testConnection() {
  return client.bridge.ping()
    .then(() => console.info(`Found a bridge accessible on ${client.config.host}`))
    .catch(exitWithError)
}

function authenticate() {
  if (client.username) {
    return Promise.resolve()
  }

  console.info(
    '\nPress the link-button on the bridge so that we can authenticate.',
    '\nYou have 1 minute to do it.'
  )

  const timeoutId = setTimeout(() => {
    exitWithError(`Link button hasn't been pressed.`)
  }, config.authenticationWaitingTime)

  const user = new client.users.User({
    name: 'living-on-hue',
    deviceType: 'cli'
  })

  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      client.users.create(user)
        .then(() => {
          clearInterval(intervalId)
          clearTimeout(timeoutId)

          console.info('Successfully authenticated.')

          client.username = user.username
          resolve()
        })
        .catch(() => {})
    }, config.authenticationAttemptInterval)
  })
}

function getNewLight() {
  return new Promise((resolve) => {
    client.lights.scan()
      .then(() => {
        setTimeout(() => {
          client.lights.getNew()
            .then(lights => {
              if (lights.length === 0) {
                exitWithError(
                  `\nCouldn't detect your light, please try again.`,
                  `\nMaybe your light has already been registered in your bridge?`
                )
              }

              if (lights.length > 1) {
                exitWithError(
                  `\nFound multiple new lights; this is weird...`,
                )
              }

              resolve(lights[0])
            })
            .catch(exitWithError)
        }, config.lightScanWaitingTime)
      })
      .catch(exitWithError)
  })
}

function showLightRegistrationInstructions() {
  console.info(
    `\nTo register your LivingColors light, we'll enable touchlink in your bridge.`,
    `\nDon't worry, that's a temporary change.`,
    `\n\nTo make sure we get this right:`,
    `\n1. Put your LivingColors light close to your bridge`,
    `\n2. Make sure both your LivingColors light and bridge are on`,
    `\n3. Make sure you don't have any other (ZigBee, e.g. LivingColors, hue) lights and remotes near the bridge`,
    `\n\nPress any key when you're ready.`,
  )

  return waitForUserInput()
}

async function registerLight() {
  return showLightRegistrationInstructions()
    .then(() => client.bridge.touchlink())
    .then(() => {
      console.info(
        `\nYour LivingColors light should start blinking at any moment.`,
        `\nDetecting your light...`,
        `\nThis can take up to 30 seconds.`
      )
    })
    .then(getNewLight)
    .then(light => {
      console.info(`\nFound your light, its name is ${light.name}.`)
      return light
    })
    .catch(exitWithError)
}

function testLight(light) {
  console.info(
    `\nTo make sure we got the right light, we're gonna turn it off and on again.`,
    `\nPress any key for us to do it...`
  )

  return waitForUserInput()
    .then(() => {
      light.on = false
      return client.lights.save(light)
    })
    .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
    .then(() => {
      light.on = true
      return client.lights.save(light)
    })
    .then(() => {
      console.info(
        `\nIf the light went off and on, press any key to continue.`,
        `\nOtherwise, something went wrong and you should close and reopen this script!`
      )
    })
    .catch(exitWithError)
}

discoverBridge()
  .then(initClient)
  .then(testConnection)
  .then(authenticate)
  .then(registerLight)
  .then(testLight)
