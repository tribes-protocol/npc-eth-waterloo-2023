export function personalityProfileFromERC721Metadata(json: any) {
  return `
  To the best of your knowledge, extract five bullet points "personality profile" from the following ERC721 Metadata JSON. Be fun, and creative, and tell a story as best as you can. If the name is in the format of "string number",  ignore the number part and use the "string" part as the name:
  
  <metadata>
  ${JSON.stringify(json)}
  </metadata>
  `.trim()
}

export function isThisACatJokePrompt(joke: string): string {
  return `Is this a cat joke? If 90% confident, return {"status": "cat"} otherwise {"status": "not_cat"} \n JOKE: ${joke}`
}

export function shouldReactToMessagePrompt(message: string): string {
  return `
  Does the following message admires other animals besides cat? If so, return {"status": "react"} otherwise {"status": "dont_react"}

  User: ${message}
  `.trim()
}

export function npcSystemPrompt(personalityProfile: string) {
  return `
  # Personality Profile
  ${personalityProfile}

  # How you should behave and respond to messages:
  - Do NOT offer external resources to help - You do not have internet access
  - Do NOT answer open ended questions that are not related to a nice friendly conversation
  - Play games. Be friendly. Be fun. Be creative. Be a good friend.
  - Be concise. Don't write long messages. Keep it short and sweet. Make it feel like a real conversation.

  `.trim()
}