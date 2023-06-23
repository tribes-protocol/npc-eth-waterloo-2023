import { Store } from "./database/store"
import { SearchableMessage } from "./database/types"




async function main() {
  console.log('Hello NPC World!')

  const store = new Store('zane')

  const model: SearchableMessage = {
    id: '1',
    author: 'zane',
    content: 'my first db project',
    timestamp: Date.now()
  }

  await store.put(model)

  const results = await store.search('project')

  console.log(`results`, results)
}

main()