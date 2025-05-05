const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Check if the API key is available
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing in your environment variables");
  process.exit(1);
}

// Initialize the GoogleGenerativeAI with the API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
  apiVersion: "v1"
});

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
  }
});

app.post("/renderWithGemini", async (req, res) => {
  try {
    const { template, data } = req.body;

    if (!template || !data) {
      return res.status(400).json({ error: "Missing template or data" });
    }

    const prompt = `
You are a helpful assistant that fills HTML templates using JSON data.

Here is the HTML template (using {{mustache}} placeholders):
\`\`\`html
${template}
\`\`\`

And here is the data:
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

Please render the final HTML by replacing placeholders with the provided data.
Return ONLY the HTML code — no explanation, markdown, or code blocks.
`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    });

    // Extract the generated HTML from the correct response structure
    const response = result.response;
    if (
      response &&
      response.candidates &&
      response.candidates[0] &&
      response.candidates[0].content &&
      response.candidates[0].content.parts &&
      response.candidates[0].content.parts[0] &&
      typeof response.candidates[0].content.parts[0].text === "string"
    ) {
      const html = response.candidates[0].content.parts[0].text.trim();
      res.send(html);
    } else {
      // If the response is blocked or missing, return an error
      console.error("Gemini API returned an unexpected or blocked response:", response);
      res.status(500).json({ error: "Rendering failed: Gemini API returned no usable content." });
    }
  } catch (err) {
    console.error("Error during Gemini API rendering:", err);
    res.status(500).json({ error: "Rendering failed" });
  }
});

app.get("/", (req, res) => {
  res.send("Server is running! Use POST /renderWithGemini to render HTML.");
});

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
