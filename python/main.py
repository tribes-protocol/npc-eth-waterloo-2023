from http.server import BaseHTTPRequestHandler, HTTPServer
from sentence_transformers import SentenceTransformer
from urllib.parse import urlparse, parse_qs
import json
import numpy as np

# Load the pre-trained model
model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")


class MyRequestHandler(BaseHTTPRequestHandler):
    # GET method handler
    def do_GET(self):
        parsed_url = urlparse(self.path)
        query_params = parse_qs(parsed_url.query)

        if "sentence" in query_params:
            sentence = query_params["sentence"][0]
            embeddings = model.encode([sentence])

            self.send_response(200)

            # Set response headers
            self.send_header("Content-type", "application/json")
            self.end_headers()

            # Convert the embeddings list of tensors to a NumPy array
            embeddings_np = np.array(embeddings)

            # Convert the NumPy array to a Python list
            embeddings_list = embeddings_np.tolist()

            # Create a response dictionary
            response_data = {"message": embeddings_list}

            # Convert the response dictionary to JSON
            json_response = json.dumps(response_data)

            # Send the JSON response
            self.wfile.write(json_response.encode())
        else:
            # Set response status code for missing parameter
            self.send_response(400)

            # Set response headers
            self.send_header("Content-type", "text/html")
            self.end_headers()

            # Send the error message
            self.wfile.write(b"Missing 'sentence' parameter")


# Create an HTTP server
server_address = ("", 7020)
httpd = HTTPServer(server_address, MyRequestHandler)
print("Server running at http://localhost:7020")

# Start the server
httpd.serve_forever()
