from gc import collect
from chromadb.config import Settings
from chromadb.utils import embedding_functions
import chromadb
from typing import List
import os
from pathlib import Path
from hashlib import sha256

from torch import embedding
from message import Message


class ChromaMemory:
    def __init__(self):
        chromadb_dir = os.path.expanduser("~/.npc/chromadb")
        Path(chromadb_dir).mkdir(parents=True, exist_ok=True)
        self.client = chromadb.Client(Settings(persist_directory=chromadb_dir))

    def chroma_collection_for_channel_id(self, channel_id):
        computed_channel_id = sha256(channel_id.split("/")[0].encode()).hexdigest()[:62]
        name = f"c{computed_channel_id}"
        sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )

        collection = self.client.get_or_create_collection(name, embedding_function=sentence_transformer_ef)
        return collection

    def put(self, data):
        collection = self.chroma_collection_for_channel_id(data.channelId)
        stored = collection.get([data.id])
        if len(stored["ids"]) != 0:
            return

        collection.add(
            documents=[data.content],
            ids=[data.id],
            metadatas=[
                {
                    "author": data.author,
                    "channelId": data.channelId,
                    "timestamp": data.timestamp,
                    "sequence": data.sequence,
                }
            ],
        )

    def search(self, channelId, query, limit):
        collection = self.chroma_collection_for_channel_id(channelId)
        response = collection.query(
            query_texts=[query],
            n_results=limit,
        )
        messages = []
        for i in range(len(response["ids"][0])):
            if response["metadatas"] == None or response["documents"] == None:
                continue

            metadata = response["metadatas"][0][i]
            document = response["documents"][0][i]
            itemId = response["ids"][0][i]
            if metadata and document and itemId:
                author = metadata["author"]
                timestamp = metadata["timestamp"]
                channelId = metadata["channelId"]
                sequence = metadata["sequence"]
                content = document
                message = Message(
                    id=itemId,
                    author=author,
                    content=content,
                    timestamp=timestamp,
                    channelId=channelId,
                    sequence=sequence,
                )
                messages.append(message)
        return messages
