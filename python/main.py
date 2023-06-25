from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import json
from message import Message
from chroma_memory import ChromaMemory

memory = ChromaMemory()


class MyRequestHandler(BaseHTTPRequestHandler):
    # GET method handler
    def do_GET(self):
        parsed_url = urlparse(self.path)
        query_params = parse_qs(parsed_url.query)

        if parsed_url.path == "/query":
            if "q" in query_params:
                query = query_params["q"][0]
                channel_id = query_params["channelId"][0]
                limit = int(query_params["limit"][0])
                results = memory.search(channel_id, query, limit)
                response_data = {"messages": [vars(result) for result in results]}
                json_response = json.dumps(response_data)

                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json_response.encode())
            else:
                self.send_response(400)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                self.wfile.write(b"Missing 'q' parameter")
        else:
            self.send_response(404)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):
        parsed_url = urlparse(self.path)

        if parsed_url.path == "/add":
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            message_data = json.loads(post_data)

            # Create a new Message instance from the received data
            message = Message(
                id=message_data["id"],
                author=message_data["author"],
                content=message_data["content"],
                timestamp=message_data["timestamp"],
                channelId=message_data["channelId"],
                sequence=message_data["sequence"],
            )

            memory.put(message)

            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Message added successfully")
        else:
            self.send_response(404)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Not Found")


# Create an HTTP server
server_address = ("", 7020)
httpd = HTTPServer(server_address, MyRequestHandler)
print("Server running at http://localhost:7020")

# Start the server
httpd.serve_forever()
