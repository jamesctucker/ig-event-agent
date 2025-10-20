import type { PlasmoMessaging } from '@plasmohq/messaging'

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    // Query the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id) {
      return res.send({ success: false, error: 'No active tab found' })
    }

    // Send message to content script to get collections
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getCollections'
    })

    res.send({
      success: true,
      collections: response || []
    })
  } catch (error) {
    console.error('Error getting collections:', error)
    res.send({
      success: false,
      error: "Failed to retrieve collections. Please make sure you're on the Instagram saved page."
    })
  }
}

export default handler
