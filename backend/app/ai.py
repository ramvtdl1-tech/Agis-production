from openai import OpenAI
from .settings import settings
SYSTEM = """You are AGIS, a controlled organizational intelligence transformation engine.
Use only the supplied source material. Do not invent facts. Preserve uncertainty.
Produce structured content for human review and clearly flag unsupported or ambiguous claims."""
def transform(source_text,cfg):
    if not settings.openai_api_key:raise RuntimeError("OPENAI_API_KEY is not configured")
    c=OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
    prompt=f"""Create a {cfg['output_type']}.
Target audience: {cfg['target_audience']}
Language: {cfg['language']}
Objective: {cfg['objective']}
Tone: {cfg['tone']}
Detail level: {cfg['detail_level']}
Content style: {cfg['content_style']}

SOURCE DOCUMENT:
{source_text[:120000]}"""
    r=c.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role":"system","content":SYSTEM},
            {"role":"user","content":prompt},
        ],
    )
    return (r.choices[0].message.content or "").strip()
