const huejay = require('huejay')
const inquirer = require('inquirer')

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
let light

function exitWithError(...errorMessages) {
  if (!errorMessages.length) {
    errorMessages.push(
      `Please restart this script and follow *all* the steps to be safe.`
    )
  }

  errorMessages.push('Aborting...')
  console.error(...errorMessages)
  cleanup()
  process.exit(1)
}

function confirm(message) {
  return inquirer.prompt([{
    type: 'confirm',
    name: 'confirmation',
    message
  }])
    .then(answers => {
      if (answers.confirmation) {
        return Promise.resolve()
      }

      exitWithError()
    })
}

// This function is just for debugging purposes
async function getLastExistentLight() {
  const lastLights = await client.lights.getAll()
  const lastLight = lastLights[lastLights.length - 1]

  light = lastLight

  console.log(`Using light "${light.name}"`)

  return Promise.resolve()
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

              // Returning the latest new night,
              // just in case multiple were detected recently.
              resolve(lights[lights.length - 1])
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
  )

  return confirm('Are you ready?')
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
    .then(newLight => {
      light = newLight

      console.info(`\nFound your light, its name is ${light.name}.`)
    })
    .catch(exitWithError)
}

function testLight() {
  console.info(
    `\nTo make sure the connection to bridge works, we're gonna turn it off and on again.`
  )

  return confirm('Continue?')
    .then(() => {
      light.on = false
      return client.lights.save(light)
    })
    .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
    .then(() => {
      light.on = true
      return client.lights.save(light)
    })
    .then(() => confirm('Has the light gone off and on again?'))
    .catch(exitWithError)
}

function showRemoteRegistrationInstructions() {
  console.info(
    `\nNow it's time to register your LivingColors remote, we'll use touchlink again.`,
    `\n\nTo make sure we get this right:`,
    `\n1. Make sure your LivingColors light is unplugged from the socket`,
    `\n2. Make sure your bridge is on`,
    `\n3. Make sure you don't have any other (ZigBee, e.g. LivingColors, hue) lights and remotes near the bridge`,
    `\n4. Open the battery lid of your LivingColors remote and press and hold the reset button with a paper clip until you see an LED go on`,
    `\n5. Hold your LivingColors remote close to your bridge`,
    `\n6. *After* you say yes below, you have to start holding the remote I button`,
  )

  return confirm('Are you ready?')
}

function registerRemote() {
  return showRemoteRegistrationInstructions()
    .then(() => client.bridge.touchlink())
    .then(() => {
      console.info(
        `\nHold the remote I button for few seconds until it stops blinking.`,
      )
    })
    .then(() => new Promise(resolve => setTimeout(resolve, 5000)))
    .then(() => {
      console.info(
        `\nThe remote LED should have blinked slow at the end.`,
        `\nIf the remote LED blinked very fast at the end, it didn't work.`,
        `\nOften it won't work on the first time.`,
      )
    })
    .then(() => confirm('Has the remote LED blinked slowly at the end?'))
    .then(() => {
      console.info(
        `\nNow plug in your LivingColors light again.`,
        `\nPress and hold the I remote button close to the light until the light blinks and stops.`,
        `\nThen release the I button.`,
      )
    })
    .then(() => confirm('Can you now control the light with the remote?'))
    .then(() => {
      console.info(
        `\nJust to be sure, we're gonna test your light again.`
      )
    })
    .then(testLight)
}

function cleanup() {
  client.users.delete(client.username)
    .catch(exitWithError)
}

discoverBridge()
  .then(initClient)
  .then(testConnection)
  .then(authenticate)
  .then(registerLight)
  // The following line is just for debugging purposes
  // .then(getLastExistentLight)
  .then(testLight)
  .then(registerRemote)
  .then(cleanup)
