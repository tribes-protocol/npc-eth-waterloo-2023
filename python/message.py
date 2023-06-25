class Message:
    def __init__(self, id, author, content, timestamp, channelId, sequence):
        self.id = id
        self.author = author
        self.content = content
        self.timestamp = timestamp
        self.channelId = channelId
        self.sequence = sequence
