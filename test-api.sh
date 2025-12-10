#!/bin/bash
# Test script for Firasah AI after LLaVA activation

echo "🔍 Testing Firasah AI with a sample image..."
echo ""

# Sample image (small base64 encoded red dot)
IMAGE="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

# Make the API call
curl -X POST https://firasah.neotodak.com/.netlify/functions/analyze-image-replicate \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$IMAGE\"}" \
  -w "\n\nStatus Code: %{http_code}\nTime: %{time_total}s\n"

echo ""
echo "✅ Test complete!"
echo ""
echo "If you see a 500/502 error, please:"
echo "1. Visit: https://firasah.neotodak.com/activate-llava.html"
echo "2. Follow the activation steps"
echo "3. Run this test again"
