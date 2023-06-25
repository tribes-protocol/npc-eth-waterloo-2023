
# from sentence_transformers import SentenceTransformer
# sentences = ["This is an example sentence", "Each sentence is converted"]

# model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
# embeddings = model.encode(sentences)
# print(embeddings)

from sentence_transformers import SentenceTransformer, util

# Load the pre-trained model
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')

# Example sentences
sentences = ["This is an example sentence", "Each sentence is converted"]

# Encode the sentences to obtain their embeddings
embeddings = model.encode(sentences)
print(embeddings)

# Test string for semantic search
test_string = "This is a test sentence"

# Encode the test string to obtain its embedding
test_embedding = model.encode([test_string])

# Perform semantic search using cosine similarity
cos_sim_scores = util.cos_sim(test_embedding, embeddings)[0]

# Sort the scores in descending order
results = sorted(zip(sentences, cos_sim_scores),
                 key=lambda x: x[1], reverse=True)

# Print the results
for sentence, score in results:
    print(f"Sentence: {sentence} | Similarity Score: {score}")

x = 7


# """
# Download your tweet archive from Twitter.
# here will be a file called data/tweets.js. It will contain a single variable
# assigned to an array of tweet objects.
# Edit it, leave only the array and rename it to tweets.json.
# This requires having chromadb and InstructorEmbedding installed via pip.
# """
# from chromadb.config import Settings
# from chromadb.utils import embedding_functions
# import chromadb
# import json
# import time

# dirname = "mytweets"
# #remove the device parameter below if you don't have a cuda-capable gpu
# embeddings = embedding_functions.InstructorEmbeddingFunction(device='cuda')

# alltweets = json.load(open("tweets.json"))
# tweets = [t['tweet'] for t in alltweets if not t['tweet']['full_text'].startswith("RT")]

# client = chromadb.Client(Settings(chroma_db_impl="duckdb+parquet",
#                                     persist_directory=dirname))

# alltweets = json.load(open("tweets.json"))
# tweets = [t['tweet'] for t in alltweets if not t['tweet']['full_text'].startswith("RT")]
# total = len(tweets)
# print(f"we have {total} tweets.")

# coll = client.get_or_create_collection("tweets", embedding_function=embeddings)
# if coll.count() != total:
#     i = 0
#     batch_size = 20 #that's how much my gpu can do at a time

#     toembed = [t["full_text"] for t in tweets]
#     ids = [str(i) for i in range(total)]

#     before = time.time()
#     while i < len(toembed):
#         coll.add(documents=toembed[i:i+batch_size], metadatas=None, ids=ids[i:i+batch_size])
#         i += batch_size
#         print(f"embedded: {i}")
#     t = time.time() - before

# while True:
#     query = input("query: ")
#     try:
#         response = coll.query(query_texts=query, n_results = 10)
#         for i, t in enumerate(response['documents'][0]):
#             print(i, t)
#     except Exception as e:
#         print(e)
