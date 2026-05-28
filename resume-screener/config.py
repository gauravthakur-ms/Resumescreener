"""
Configuration module — loads all environment variables and constants.
Never hardcode secrets, skills, thresholds, or scoring weights here.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Azure OpenAI
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_MODEL_NAME = os.getenv("AZURE_OPENAI_MODEL_NAME", "")
AZURE_OPENAI_FALLBACK_MODEL_NAME = os.getenv("AZURE_OPENAI_FALLBACK_MODEL_NAME", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

# Azure Storage (single account for Blob + Queue)
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")

# Azure Cosmos DB
AZURE_COSMOS_ENDPOINT = os.getenv("AZURE_COSMOS_ENDPOINT", "")
AZURE_COSMOS_KEY = os.getenv("AZURE_COSMOS_KEY", "")
AZURE_COSMOS_DATABASE_NAME = os.getenv("AZURE_COSMOS_DATABASE_NAME", "resume-screener-db")

# Blob container names
BLOB_CONTAINER_JD = os.getenv("BLOB_CONTAINER_JD", "jd-uploads")
BLOB_CONTAINER_RESUMES = os.getenv("BLOB_CONTAINER_RESUMES", "resumes")
BLOB_CONTAINER_EXPORTS = os.getenv("BLOB_CONTAINER_EXPORTS", "exports")

# Queue name
QUEUE_NAME = os.getenv("QUEUE_NAME", "resume-processing-queue")

# Cosmos DB container names
COSMOS_CONTAINER_JD = os.getenv("COSMOS_CONTAINER_JD", "job-descriptions")
COSMOS_CONTAINER_CANDIDATES = os.getenv("COSMOS_CONTAINER_CANDIDATES", "candidates")
COSMOS_CONTAINER_BATCHES = os.getenv("COSMOS_CONTAINER_BATCHES", "batches")

# Processing limits
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
QUEUE_VISIBILITY_TIMEOUT = int(os.getenv("QUEUE_VISIBILITY_TIMEOUT", "300"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY_SECONDS = int(os.getenv("RETRY_DELAY_SECONDS", "2"))

# Skills alias map for normalization
SKILLS_ALIAS_MAP = {
    "kotlin": "Kotlin",
    "kotlin language": "Kotlin",
    "java": "JAVA",
    "java programming": "JAVA",
    "frida": "Frida",
    "frida tool": "Frida",
    "ida pro": "IDA Pro",
    "idapro": "IDA Pro",
    "ida": "IDA Pro",
    "ghidra": "Ghidra",
    "android": "Android",
    "android apk": "Android",
    "android development": "Android",
    "malware analysis": "Malware Analysis",
    "malware": "Malware Analysis",
    "reverse engineering": "Reverse Engineering",
    "reversing": "Reverse Engineering",
    "cybersecurity": "CyberSecurity",
    "cyber security": "CyberSecurity",
    "information security": "CyberSecurity",
    "dart": "Dart",
    "flutter": "Flutter",
    "react": "React",
    "react native": "React Native",
    "python": "Python",
    "c++": "C++",
    "c#": "C#",
    ".net": ".NET",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "sql": "SQL",
    "nosql": "NoSQL",
    "mongodb": "MongoDB",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "k8s": "Kubernetes",
    "aws": "AWS",
    "azure": "Azure",
    "gcp": "GCP",
    "terraform": "Terraform",
    "ci/cd": "CI/CD",
    "jenkins": "Jenkins",
    "git": "Git",
    "machine learning": "Machine Learning",
    "ml": "Machine Learning",
    "deep learning": "Deep Learning",
    "nlp": "NLP",
    "natural language processing": "NLP",
    "data science": "Data Science",
    "power bi": "Power BI",
    "tableau": "Tableau",
    "excel": "Excel",
    "static analysis": "Static Analysis",
    "dynamic analysis": "Dynamic Analysis",
}
