"""
Blog Agent for Bunnies Plumbing & Trenchless Technology
Generates SEO-optimized, internally-linked blog posts using OpenAI.
Posts include links to site pages, other blog posts, and practical
problem-solving content that drives traffic and conversions.

Usage:
    python blog_agent.py          # Run as persistent scheduler (2x daily)
    python blog_agent.py --now    # Generate one post immediately
"""

import argparse
import json
import logging
import os
import random
import re
import subprocess
import sys
import time
from datetime import datetime, date
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    import schedule
except ImportError:
    print("Error: schedule package not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    from slugify import slugify
except ImportError:
    print("Error: python-slugify package not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

# --- Paths ---
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_PATH = SCRIPT_DIR / "config.json"
TEMPLATE_PATH = SCRIPT_DIR / "post_template.html"
TRACKER_PATH = SCRIPT_DIR / "generated_posts.json"
BLOG_HTML_PATH = PROJECT_DIR / "blog.html"
POSTS_DIR = PROJECT_DIR / "posts"

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(SCRIPT_DIR / "blog_agent.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("blog_agent")

# --- Internal Site Pages (for linking from blog posts) ---
# Posts are in /posts/ so site pages are at ../ relative path
SITE_PAGES = {
    "contact": {
        "url": "../contact.html",
        "anchor_text_options": [
            "contact us today",
            "get in touch with our team",
            "reach out to us",
            "book a service appointment",
            "schedule a service",
        ],
        "use_when": "CTA, booking, getting help, asking questions",
    },
    "services": {
        "url": "../services.html",
        "anchor_text_options": [
            "view all our plumbing services",
            "explore our full range of services",
            "our professional plumbing services",
            "see what services we offer",
        ],
        "use_when": "mentioning multiple services, general service overview",
    },
    "trenchless": {
        "url": "../trenchless.html",
        "anchor_text_options": [
            "learn more about trenchless technology",
            "our trenchless sewer repair process",
            "trenchless pipe replacement",
            "see how trenchless works",
        ],
        "use_when": "trenchless, pipe bursting, CIPP, pipe lining, no-dig repair",
    },
    "estimate": {
        "url": "../estimate.html",
        "anchor_text_options": [
            "get a free estimate",
            "request your free quote",
            "use our free estimate calculator",
            "check pricing for your project",
        ],
        "use_when": "pricing, cost, quotes, how much does it cost",
    },
    "about": {
        "url": "../about.html",
        "anchor_text_options": [
            "learn more about our team",
            "about Bunnies Plumbing",
            "our experienced team",
            "why homeowners trust us",
        ],
        "use_when": "company credibility, team expertise, trust, experience",
    },
    "reviews": {
        "url": "../reviews.html",
        "anchor_text_options": [
            "read what our customers say",
            "see our 126+ five-star reviews",
            "check out our customer reviews",
        ],
        "use_when": "social proof, customer satisfaction, testimonials, trust",
    },
    "faq": {
        "url": "../faq.html",
        "anchor_text_options": [
            "check our FAQ page",
            "find answers to common questions",
            "read our frequently asked questions",
        ],
        "use_when": "common questions, general plumbing questions",
    },
    "gallery": {
        "url": "../gallery.html",
        "anchor_text_options": [
            "see our project gallery",
            "view real project photos",
            "browse our completed work",
        ],
        "use_when": "examples of work, before/after, project photos",
    },
}


def load_config():
    """Load configuration from config.json."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_tracker():
    """Load the generated posts tracker."""
    if not TRACKER_PATH.exists():
        return []
    with open(TRACKER_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_tracker(tracker):
    """Save the generated posts tracker."""
    with open(TRACKER_PATH, "w", encoding="utf-8") as f:
        json.dump(tracker, f, indent=2, ensure_ascii=False)


def load_template():
    """Load the HTML post template."""
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        return f.read()


def posts_generated_today(tracker):
    """Count how many posts were generated today."""
    today = date.today().isoformat()
    return sum(1 for entry in tracker if entry.get("date") == today)


def pick_topic(config, tracker):
    """Pick a topic that hasn't been used yet. Returns None if all used."""
    used_slugs = {entry["slug"] for entry in tracker}
    used_topics = {entry.get("topic", "") for entry in tracker}

    available = [
        t for t in config["topics"]
        if t not in used_topics and slugify(t) not in used_slugs
    ]
    if available:
        return random.choice(available)
    return None


def get_existing_blog_posts(tracker):
    """Build a list of existing blog posts for cross-linking."""
    posts = []
    for entry in tracker[:15]:  # Last 15 posts for cross-linking
        posts.append({
            "title": entry["title"],
            "url": f"../posts/{entry['slug']}.html",
            "category": entry.get("category", ""),
        })
    return posts


def build_internal_links_context(existing_posts):
    """Build the internal linking instructions for the AI prompt."""
    # Site pages
    pages_info = []
    for name, info in SITE_PAGES.items():
        pages_info.append(
            f"  - {name}: URL=\"{info['url']}\" | Use when: {info['use_when']} | "
            f"Example anchor: \"{info['anchor_text_options'][0]}\""
        )

    # Existing blog posts for cross-linking
    blog_links = []
    for post in existing_posts[:10]:
        blog_links.append(f"  - \"{post['title']}\" → URL=\"{post['url']}\"")

    links_section = "INTERNAL SITE PAGES (you MUST link to at least 3 of these within the article):\n"
    links_section += "\n".join(pages_info)

    if blog_links:
        links_section += "\n\nEXISTING BLOG POSTS (link to 1-3 related posts where relevant):\n"
        links_section += "\n".join(blog_links)

    return links_section


def generate_fresh_topic(client, config, tracker):
    """Ask OpenAI to generate a fresh plumbing blog topic."""
    logger.info("All predefined topics used. Asking AI for a fresh topic...")

    used_topics = [entry.get("topic", "") for entry in tracker[:30]]
    used_list = "\n".join(f"- {t}" for t in used_topics) if used_topics else "None yet"

    response = client.chat.completions.create(
        model=config["openai_model"],
        messages=[
            {
                "role": "system",
                "content": (
                    f"You are a plumbing SEO content strategist for {config['site_name']} "
                    f"in {config['site_location']}. Generate practical, searchable blog topics "
                    "that homeowners actually Google. Mix between these types: "
                    "1) Problem-solving content ('how to fix...', 'what causes...', 'signs of...') "
                    "2) Service-focused content that explains what causes people to need specific "
                    "plumbing services like trenchless sewer repair, drain cleaning, water heater "
                    "replacement, gas line repair, crawl space plumbing, emergency plumbing "
                    "3) Company/trust content about why to choose a licensed plumber, what to expect "
                    "during a service call, real customer scenarios. "
                    "Topics should naturally lead readers toward needing professional help."
                ),
            },
            {
                "role": "user",
                "content": f"Generate ONE unique plumbing blog topic. It must NOT overlap with these already-used topics:\n{used_list}\n\nReturn ONLY the topic title, nothing else.",
            },
        ],
        temperature=0.9,
        max_tokens=100,
    )
    return response.choices[0].message.content.strip().strip('"')


def generate_blog_content(client, config, topic, existing_posts):
    """Generate blog content via OpenAI API with internal linking and SEO optimization."""

    internal_links_context = build_internal_links_context(existing_posts)

    prompt = f"""Write a high-quality, SEO-optimized blog post for "{config['site_name']}" — a licensed plumbing company in {config['site_location']} serving the entire Bay Area.

TOPIC: {topic}

COMPANY INFO:
- Name: {config['site_name']}
- Phone: {config['site_phone']}
- Location: {config['site_location']}
- Services: Trenchless sewer repair (pipe bursting & CIPP lining), sewer line services, water main line services, drain cleaning & hydro jetting, crawl space plumbing, gas line services, water heater services, general plumbing, 24/7 emergency plumbing
- Has 126+ five-star reviews, 20+ years experience, licensed & insured

{internal_links_context}

Return your response as valid JSON with these exact keys:
{{
    "title": "SEO-optimized blog post title (include location or service keyword, 55-65 chars)",
    "meta_description": "Compelling meta description with keyword and CTA (under 155 characters)",
    "keywords": "comma-separated long-tail SEO keywords (6-10 keywords targeting what people search)",
    "excerpt": "2-sentence hook for the blog card — make the reader NEED to click",
    "category": "One category: Trenchless Technology | Sewer Lines | Drain Cleaning | Water Heaters | Gas Lines | Emergency Tips | Plumbing Tips | Home Maintenance | Repiping | DIY & Prevention | Our Services | Company News",
    "content": "The full blog post body as HTML markup (see requirements below)"
}}

CRITICAL REQUIREMENTS for the "content" field:

CONTENT QUALITY:
- Write 1000-1500 words of genuinely helpful, practical content
- Start with a hook paragraph that addresses the reader's pain point directly
- Write like you're talking to a homeowner who just Googled this problem — be helpful, not salesy
- Include practical DIY tips where appropriate, but make it clear when professional help is needed
- Include specific details (temperatures, measurements, timeframes, costs ranges) to build authority
- Mention {config['site_location']} and Bay Area naturally 2-3 times for local SEO

SERVICE-FOCUSED CONTENT:
- If the topic relates to a specific service (trenchless, sewer, drain cleaning, water heater, gas lines, crawl space, emergency, water main), EXPLAIN what causes homeowners to need that service
- Describe real-world scenarios: "You might notice your yard is soggy near the sewer line..." or "If you smell rotten eggs near your gas appliances..."
- Paint the picture of the problem, explain why it happens, then naturally lead to why professional service is the solution
- Mention HOW the company performs the service — e.g. for trenchless: "We use pipe bursting technology to replace your old pipe without digging up your yard"
- Include a comparison of DIY vs professional when relevant — show readers that while they can try basic fixes, certain problems REQUIRE a licensed plumber
- If the topic is about the company itself (reviews, process, team), write it as an informative, trust-building piece — not a sales pitch

STRUCTURE:
- Use <h2> for main sections (4-6 sections), <h3> for subsections where needed
- Include at least 2 bulleted/numbered lists with <ul>/<li> or <ol>/<li>
- Use <strong> for key terms and important warnings
- NO <h1> tag (handled by template), NO <html>/<head>/<body> wrappers

INTERNAL LINKING (MANDATORY):
- Include at least 3-5 internal links using <a href="URL">descriptive anchor text</a>
- Link to the contact page when suggesting readers get professional help
- Link to the estimate page when discussing costs or pricing
- Link to the services page when mentioning specific services
- Link to the trenchless page when trenchless repair is relevant
- Link to related blog posts when referencing topics covered in other articles
- Links should feel natural — weave them into sentences, not forced
- Use descriptive anchor text (not "click here"), e.g. <a href="../contact.html">schedule a professional inspection</a>

CALL-TO-ACTION:
- Include a mid-article CTA (subtle — e.g., "If you notice these signs, <a href='../contact.html'>contact a licensed plumber</a> right away.")
- End with a strong CTA paragraph mentioning the company name, phone number {config['site_phone']}, and linking to the contact page
- The tone should be "we're here to help" not "buy our stuff"

SEO:
- Use the target keyword naturally in the first paragraph
- Include semantic variations and related terms throughout
- Write for humans first, search engines second
- Structure content to potentially earn featured snippets (lists, direct answers to questions)"""

    response = client.chat.completions.create(
        model=config["openai_model"],
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert plumbing content writer and SEO specialist. "
                    "You write authoritative, genuinely helpful blog posts that rank on Google "
                    "and convert readers into customers. You understand local SEO, internal linking "
                    "strategy, and how to write content that answers real homeowner questions. "
                    "You always include internal links to the company's website pages. "
                    "Always respond with valid JSON only — no markdown code fences, just raw JSON."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()
    return json.loads(raw)


def estimate_reading_time(html_content):
    """Estimate reading time from HTML content (average 200 words/min)."""
    text = re.sub(r"<[^>]+>", " ", html_content)
    words = len(text.split())
    minutes = max(1, round(words / 200))
    return minutes


def create_post_html(template, data):
    """Fill the template with generated content and return the final HTML."""
    today = date.today()
    date_display = today.strftime("%B %d, %Y")
    date_iso = today.isoformat()
    title_short = data["title"][:50] + "..." if len(data["title"]) > 50 else data["title"]
    reading_time = str(estimate_reading_time(data["content"]))

    html = template
    html = html.replace("{{TITLE}}", data["title"])
    html = html.replace("{{TITLE_SHORT}}", title_short)
    html = html.replace("{{META_DESCRIPTION}}", data["meta_description"])
    html = html.replace("{{KEYWORDS}}", data.get("keywords", "plumbing, Morgan Hill"))
    html = html.replace("{{DATE_DISPLAY}}", date_display)
    html = html.replace("{{DATE_ISO}}", date_iso)
    html = html.replace("{{CATEGORY}}", data["category"])
    html = html.replace("{{READING_TIME}}", reading_time)
    html = html.replace("{{CONTENT}}", data["content"])
    html = html.replace("{{SLUG}}", slugify(data["title"]))
    return html


def save_post_file(slug, html):
    """Save the generated post HTML to the posts/ directory."""
    POSTS_DIR.mkdir(exist_ok=True)
    filepath = POSTS_DIR / f"{slug}.html"
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    logger.info(f"Post file saved: {filepath}")
    return filepath


def get_category_icon(category):
    """Return a Font Awesome icon class based on category."""
    icons = {
        "trenchless technology": "fas fa-hard-hat",
        "maintenance": "fas fa-wrench",
        "home maintenance": "fas fa-home",
        "emergency tips": "fas fa-exclamation-triangle",
        "sewer lines": "fas fa-water",
        "water heaters": "fas fa-temperature-high",
        "safety": "fas fa-shield-alt",
        "plumbing tips": "fas fa-tools",
        "drain cleaning": "fas fa-shower",
        "repiping": "fas fa-random",
        "gas lines": "fas fa-fire",
        "diy & prevention": "fas fa-toolbox",
        "our services": "fas fa-concierge-bell",
        "company news": "fas fa-newspaper",
    }
    return icons.get(category.lower(), "fas fa-wrench")


def build_blog_card(slug, data):
    """Build the HTML for a new blog card to insert into blog.html."""
    today = date.today()
    date_display = today.strftime("%b %d, %Y")
    icon_class = get_category_icon(data["category"])

    card = f"""
                    <!-- Blog Card — {data['title']} -->
                    <div class="blog-card animate-on-scroll fade-up">
                        <div class="blog-card__img">
                            <i class="{icon_class}"></i>
                        </div>
                        <div class="blog-card__body">
                            <span class="blog-card__meta">{data['category']} &mdash; {date_display}</span>
                            <h3><a href="posts/{slug}.html">{data['title']}</a></h3>
                            <p>{data['excerpt']}</p>
                            <a href="posts/{slug}.html" class="blog-card__link">Read More <i class="fas fa-arrow-right"></i></a>
                        </div>
                    </div>"""
    return card


def update_blog_html(card_html):
    """Insert a new blog card at the top of the blog__grid in blog.html."""
    with open(BLOG_HTML_PATH, "r", encoding="utf-8") as f:
        html = f.read()

    marker = '<div class="blog__grid">'
    idx = html.find(marker)
    if idx == -1:
        logger.error("Could not find blog__grid in blog.html")
        return False

    insert_pos = idx + len(marker)
    updated = html[:insert_pos] + "\n" + card_html + html[insert_pos:]

    with open(BLOG_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(updated)

    logger.info("blog.html updated with new blog card")
    return True


def git_commit_and_push(slug, title):
    """Stage changes, commit, and push to git."""
    try:
        result = subprocess.run(
            ["git", "status"],
            cwd=str(PROJECT_DIR),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.warning("Not a git repository. Skipping git operations.")
            return False

        files_to_stage = [
            str(POSTS_DIR / f"{slug}.html"),
            str(BLOG_HTML_PATH),
            str(TRACKER_PATH),
        ]
        for filepath in files_to_stage:
            subprocess.run(
                ["git", "add", filepath],
                cwd=str(PROJECT_DIR),
                capture_output=True,
                text=True,
            )

        commit_msg = f"blog: add new post — {title}"
        result = subprocess.run(
            ["git", "commit", "-m", commit_msg],
            cwd=str(PROJECT_DIR),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            if "nothing to commit" in result.stdout:
                logger.info("Nothing to commit.")
                return True
            logger.error(f"Git commit failed: {result.stderr}")
            return False

        logger.info(f"Git commit created: {commit_msg}")

        result = subprocess.run(
            ["git", "push"],
            cwd=str(PROJECT_DIR),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.warning(f"Git push failed: {result.stderr}")
            logger.info("Commit was created locally. Push manually when ready.")
            return True

        logger.info("Changes pushed to remote.")
        return True

    except FileNotFoundError:
        logger.warning("Git not found. Skipping git operations.")
        return False


def generate_post():
    """Main function: pick topic, generate content, create files, update blog, commit."""
    logger.info("=" * 60)
    logger.info("Starting blog post generation...")

    config = load_config()
    tracker = load_tracker()
    template = load_template()

    # Check daily limit (2 posts per day)
    max_daily = config.get("posts_per_day", 2)
    today_count = posts_generated_today(tracker)
    if today_count >= max_daily:
        logger.info(f"Already generated {today_count}/{max_daily} posts today. Skipping.")
        return

    # Initialize OpenAI client
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable not set.")
        return
    client = OpenAI(api_key=api_key)

    # Pick a topic
    topic = pick_topic(config, tracker)
    if topic is None:
        topic = generate_fresh_topic(client, config, tracker)
    logger.info(f"Selected topic: {topic}")

    # Get existing posts for cross-linking
    existing_posts = get_existing_blog_posts(tracker)

    # Generate content
    try:
        data = generate_blog_content(client, config, topic, existing_posts)
    except Exception as e:
        logger.error(f"Failed to generate blog content: {e}")
        return

    # Validate required fields
    required_fields = ["title", "meta_description", "excerpt", "category", "content"]
    for field in required_fields:
        if field not in data:
            logger.error(f"Generated content missing required field: {field}")
            return

    logger.info(f"Generated post: {data['title']}")

    # Verify internal links are present
    link_count = data["content"].count('href="../')
    if link_count < 2:
        logger.warning(f"Only {link_count} internal links found. Post may need more linking.")

    # Create slug
    post_slug = slugify(data["title"])

    # Check for duplicate slug
    if any(entry["slug"] == post_slug for entry in tracker):
        logger.warning(f"Slug '{post_slug}' already exists. Skipping.")
        return

    # Create the post HTML file
    post_html = create_post_html(template, data)
    save_post_file(post_slug, post_html)

    # Build the blog card and update blog.html
    card_html = build_blog_card(post_slug, data)
    if not update_blog_html(card_html):
        logger.error("Failed to update blog.html")
        return

    # Log to tracker
    tracker.insert(0, {
        "slug": post_slug,
        "title": data["title"],
        "topic": topic,
        "category": data["category"],
        "date": date.today().isoformat(),
        "meta_description": data["meta_description"],
    })
    save_tracker(tracker)

    # Git commit and push
    git_commit_and_push(post_slug, data["title"])

    logger.info(f"Blog post generated successfully: {post_slug}")
    logger.info(f"Internal links found: {link_count}")
    logger.info(f"Posts today: {today_count + 1}/{max_daily}")
    logger.info("=" * 60)


def run_scheduler(config):
    """Run the persistent scheduler that generates posts at configured times."""
    schedule_times = config.get("schedule_times", ["08:00", "18:00"])

    for t in schedule_times:
        schedule.every().day.at(t).do(generate_post)

    logger.info(f"Blog agent started. Scheduled to run daily at: {', '.join(schedule_times)}")
    logger.info(f"Posts per day limit: {config.get('posts_per_day', 2)}")
    logger.info("Press Ctrl+C to stop.")

    while True:
        schedule.run_pending()
        time.sleep(60)


def main():
    parser = argparse.ArgumentParser(
        description="Bunnies Plumbing Blog Agent — Auto-generates SEO blog posts"
    )
    parser.add_argument(
        "--now",
        action="store_true",
        help="Generate a post immediately instead of running the scheduler",
    )
    args = parser.parse_args()

    if args.now:
        generate_post()
    else:
        config = load_config()
        run_scheduler(config)


if __name__ == "__main__":
    main()
