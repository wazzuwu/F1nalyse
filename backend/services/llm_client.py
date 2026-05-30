"""LLM client — supports both Groq and Google Gemini as providers.

Set LLM_PROVIDER in .env to switch between them:
  - "groq":  uses GROQ_API_KEY + LLM_MODEL
  - "gemini": uses GEMINI_API_KEY + LLM_MODEL
"""

from backend.config import settings

_groq_client = None
_gemini_client = None


def _get_groq():
    global _groq_client
    if _groq_client is None:
        import groq
        _groq_client = groq.Client(api_key=settings.groq_api_key)
    return _groq_client


def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        _gemini_client = genai.Client(api_key=settings.gemini_api_key)
    return _gemini_client


def chat_completion(
    messages: list[dict],
    tools: list[dict] | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> dict:
    """
    Unified chat completion — routes to Groq or Gemini based on
    settings.llm_provider.

    Args:
      messages: Standard chat messages [{"role": "...", "content": "..."}]
      tools: (Groq only) Tool definitions for function calling
      model: Override the default model from settings
      temperature: Override the default temperature from settings

    Returns:
      A response object with .choices[0].message.content
    """
    provider = settings.llm_provider
    model = model or settings.llm_model
    temperature = temperature if temperature is not None else settings.llm_temperature

    if provider == "groq":
        client = _get_groq()
        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
        return client.chat.completions.create(**kwargs)

    elif provider == "gemini":
        client = _get_gemini()
        # Convert messages to Gemini format
        # Gemini expects a single user prompt in its simplest form
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                # Prepend system prompt to first user message
                if contents:
                    contents[0] = f"{content}\n\n{contents[0]}"
                else:
                    contents.append(content)
            else:
                contents.append(content)

        prompt = "\n".join(contents)

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={"temperature": temperature},
        )

        # Wrap response to match Groq interface for compatibility
        return _GeminiResponse(response)

    else:
        raise ValueError(f"Unknown LLM provider: {provider}. Use 'groq' or 'gemini'.")


class _GeminiResponse:
    """Minimal wrapper to make Gemini responses look like Groq responses."""

    def __init__(self, response):
        self.choices = [_GeminiChoice(response)]


class _GeminiChoice:
    def __init__(self, response):
        self.message = _GeminiMessage(response)


class _GeminiMessage:
    def __init__(self, response):
        self.content = response.text


def extraction_completion(raw_text: str, prompt_template: str) -> dict:
    """
    Convenience wrapper specifically for PDF extraction.
    Uses the extraction_model from settings instead of the RAG model.
    """
    provider = settings.llm_provider

    if provider == "groq":
        return chat_completion(
            messages=[{"role": "user", "content": prompt_template.format(text=raw_text)}],
            model=settings.extraction_model,
            temperature=0.1,
        )
    elif provider == "gemini":
        return chat_completion(
            messages=[{"role": "user", "content": prompt_template.format(text=raw_text)}],
            model=settings.extraction_model,
            temperature=0.1,
        )
