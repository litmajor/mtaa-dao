#!/bin/sh
set -e

# Read stdin into a temp file and run the inner wrapper
PAYLOAD_FILE=/tmp/payload.json
cat - > "$PAYLOAD_FILE"

# Execute inner wrapper which will call freqtrade inside the container
python /app/freqtrade_wrapper_inner.py "$PAYLOAD_FILE"
