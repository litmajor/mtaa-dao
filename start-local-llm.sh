#!/bin/bash

# Start All Local LLM Services
# Usage: chmod +x start-local-llm.sh && ./start-local-llm.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Starting Local LLM Services${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Check if Ollama is installed
echo -e "${YELLOW}Checking Ollama installation...${NC}"
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama not found!${NC}"
    echo -e "${CYAN}Please install from: https://ollama.ai${NC}"
    echo -e "${CYAN}Then run: ollama pull llama2${NC}"
    exit 1
fi

OLLAMA_PATH=$(which ollama)
echo -e "${GREEN}✅ Ollama found at: $OLLAMA_PATH${NC}"
echo ""

# Check if LLaMA model exists
echo -e "${YELLOW}Checking LLaMA 2 model...${NC}"
if ollama list 2>/dev/null | grep -q "llama2"; then
    echo -e "${GREEN}✅ LLaMA 2 model found${NC}"
else
    echo -e "${YELLOW}⚠️  LLaMA 2 model not found. Downloading...${NC}"
    ollama pull llama2
fi

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Starting Services${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Create a temporary directory for PIDs and logs
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Function to wait for HTTP endpoint
wait_for_endpoint() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=0
    
    echo -e "${YELLOW}Waiting for $name to be ready...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name is ready${NC}"
            return 0
        fi
        sleep 0.5
        ((attempt++))
    done
    echo -e "${YELLOW}⚠️  $name connection timeout. Continuing anyway...${NC}"
    return 0
}

# Terminal 1: Start Ollama
echo -e "${YELLOW}Starting Ollama service...${NC}"
ollama serve > "$TEMP_DIR/ollama.log" 2>&1 &
OLLAMA_PID=$!
echo $OLLAMA_PID > "$TEMP_DIR/ollama.pid"
echo -e "${GREEN}✅ Ollama started (PID: $OLLAMA_PID)${NC}"
echo ""

# Wait for Ollama to be ready
wait_for_endpoint "http://localhost:11434/api/tags" "Ollama"
echo ""

# Terminal 2: Start OpenClaw
echo -e "${YELLOW}Starting OpenClaw...${NC}"
(
    cd OpenClaw
    
    # Set environment variables
    export OPENCLAW_LLM_TYPE='local'
    export OPENCLAW_LLM_PROVIDER='local'
    export OPENCLAW_LLM_MODEL='llama-2-7b-chat'
    export OPENCLAW_LLM_BASE_URL='http://localhost:11434'
    
    npm install > /dev/null 2>&1
    npm run start > "$TEMP_DIR/openclaw.log" 2>&1
) &
OPENCLAW_PID=$!
echo $OPENCLAW_PID > "$TEMP_DIR/openclaw.pid"
echo -e "${GREEN}✅ OpenClaw startup initiated (PID: $OPENCLAW_PID)${NC}"
echo ""

# Wait for OpenClaw installation
sleep 5

# Terminal 3: Start Morio
echo -e "${YELLOW}Starting Morio...${NC}"
(
    # Set environment variables
    export MORIO_LLM_TYPE='local'
    export MORIO_LLM_PROVIDER='ollama'
    export MORIO_LLM_MODEL='llama2'
    export MORIO_LLM_BASE_URL='http://localhost:11434'
    
    npm install > /dev/null 2>&1
    npm run dev > "$TEMP_DIR/morio.log" 2>&1
) &
MORIO_PID=$!
echo $MORIO_PID > "$TEMP_DIR/morio.pid"
echo -e "${GREEN}✅ Morio startup initiated (PID: $MORIO_PID)${NC}"
echo ""

# Display status
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Service Status${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""
echo -e "${GREEN}🟢 Ollama Service:${NC}"
echo -e "   URL: http://localhost:11434"
echo -e "   Model: llama2"
echo -e "   PID: $OLLAMA_PID"
echo ""
echo -e "${GREEN}🟢 OpenClaw Agent:${NC}"
echo -e "   URL: http://localhost:5000"
echo -e "   Config: ./config/openclaw-llm.json"
echo -e "   PID: $OPENCLAW_PID"
echo ""
echo -e "${GREEN}🟢 Morio Hub:${NC}"
echo -e "   URL: http://localhost:5173"
echo -e "   Config: ./config/morio-llm.json"
echo -e "   PID: $MORIO_PID"
echo ""

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}View Logs${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""
echo -e "${YELLOW}Tail logs:${NC}"
echo -e "  ${GREEN}tail -f $TEMP_DIR/ollama.log${NC}"
echo -e "  ${GREEN}tail -f $TEMP_DIR/openclaw.log${NC}"
echo -e "  ${GREEN}tail -f $TEMP_DIR/morio.log${NC}"
echo ""

echo -e "${YELLOW}Stop services:${NC}"
echo -e "  ${GREEN}kill $OLLAMA_PID $OPENCLAW_PID $MORIO_PID${NC}"
echo ""

echo -e "${CYAN}======================================${NC}"
echo -e "${GREEN}✅ All services started!${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop...${NC}"
echo ""

# Function to clean up on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    kill $OLLAMA_PID $OPENCLAW_PID $MORIO_PID 2>/dev/null || true
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT SIGTERM

# Monitor processes
while true; do
    sleep 5
    
    # Check if any process died
    if ! kill -0 $OLLAMA_PID 2>/dev/null; then
        echo -e "${RED}❌ Ollama process died!${NC}"
        echo -e "${YELLOW}Restarting Ollama...${NC}"
        ollama serve > "$TEMP_DIR/ollama.log" 2>&1 &
        OLLAMA_PID=$!
    fi
    
    if ! kill -0 $OPENCLAW_PID 2>/dev/null; then
        echo -e "${RED}❌ OpenClaw process died!${NC}"
        echo -e "${YELLOW}Check log: tail -f $TEMP_DIR/openclaw.log${NC}"
    fi
    
    if ! kill -0 $MORIO_PID 2>/dev/null; then
        echo -e "${RED}❌ Morio process died!${NC}"
        echo -e "${YELLOW}Check log: tail -f $TEMP_DIR/morio.log${NC}"
    fi
done
