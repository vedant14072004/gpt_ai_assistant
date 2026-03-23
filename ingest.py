import os
import chromadb
from chromadb.utils import embedding_functions
from unstructured.partition.auto import partition

# 1. Setup Paths
script_dir = os.path.dirname(os.path.abspath(__file__))
knowledge_base_dir = os.path.join(script_dir, "knowledge_base")

# 2. Find ALL .txt AND .pdf files
# This line now looks for both extensions
file_extensions = (".txt", ".pdf")
file_paths = [
    os.path.join(knowledge_base_dir, f) 
    for f in os.listdir(knowledge_base_dir) 
    if f.lower().endswith(file_extensions)
]

if not file_paths:
    raise ValueError("No .txt or .pdf files found in the knowledge_base directory.")

print(f"Found {len(file_paths)} files to ingest.")

# 3. Process files
all_elements = []
for file_path in file_paths:
    print(f"Processing: {os.path.basename(file_path)}")
    try:
        elements = partition(
            filename=file_path,
            chunking_strategy="by_title",
            max_characters=512,
            combine_text_under_n_chars=256,
        )
        all_elements.extend(elements)
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")

docs = [str(e) for e in all_elements]
print(f"Found {len(docs)} document chunks.")

# 4. Setup Database
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

client = chromadb.PersistentClient(path="db")
collection = client.get_or_create_collection(
    name="college_info",
    embedding_function=sentence_transformer_ef,
    metadata={"hnsw:space": "cosine"}
)

# 5. Add to Collection
# Added a small fix: using the count of existing items to avoid overwriting IDs
current_count = collection.count()
collection.add(
    documents=docs,
    ids=[f"doc_{current_count + i}" for i in range(len(docs))]
)

print("✅ Data ingestion complete! Your notes and rulebook are now in the brain.")