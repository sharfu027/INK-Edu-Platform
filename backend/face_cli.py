#!/usr/bin/env python
# type: ignore
"""
Face Recognition CLI Bridge.
Reads a JSON payload from stdin, runs the requested face recognition or
encryption action, and writes the JSON result to stdout.
Redirects all logs to stderr to avoid corrupting stdout.
"""

import sys
import os
import json
import logging

# Ensure logs go to stderr
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
logger = logging.getLogger("face_cli")

# Set up python sys path to find app module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.services.face_recognition import face_service
    from app.utils.encryption import encrypt_embeddings, decrypt_embeddings
except Exception as e:
    print(json.dumps({"status": False, "message": f"Initialization failed: {str(e)}"}))
    sys.exit(1)


def handle_validate_full_face(args):
    """Validate full face presence and quality."""
    image_b64 = args.get("image")
    if not image_b64:
        return {"status": False, "message": "Missing image base64 data"}
    try:
        img = face_service._decode_base64_image(image_b64)
        is_valid, reason = face_service.validate_full_face(img)
        return {"status": True, "isValid": is_valid, "reason": reason}
    except Exception as e:
        return {"status": False, "message": f"Validation failed: {str(e)}"}


def handle_temporal_liveness(args):
    """Temporal liveness check comparing two frames."""
    frame1 = args.get("frame1")
    frame2 = args.get("frame2")
    if not frame1 or not frame2:
        return {"status": False, "message": "Missing one or both liveness frames"}
    try:
        is_live, reason = face_service.verify_temporal_liveness(frame1, frame2)
        return {"status": True, "isLive": is_live, "reason": reason}
    except Exception as e:
        return {"status": False, "message": f"Temporal liveness failed: {str(e)}"}


def handle_extract_embedding(args):
    """Extract a 128-d embedding from a base64 image."""
    image_b64 = args.get("image")
    strict = args.get("strict", True)
    if not image_b64:
        return {"status": False, "message": "Missing image base64 data"}
    try:
        embedding, reason = face_service.extract_embedding_with_reason(image_b64, strict=strict)
        if embedding is None:
            return {"status": False, "message": reason}
        return {"status": True, "embedding": embedding, "message": "OK"}
    except Exception as e:
        return {"status": False, "message": f"Embedding extraction failed: {str(e)}"}


def handle_extract_multiple(args):
    """Extract embeddings from 4 base64 images (registration)."""
    images = args.get("images")
    if not images or len(images) < 4:
        return {"status": False, "message": "Expected exactly 4 images for registration"}
    try:
        embeddings, errors = face_service.extract_multiple_embeddings(images)
        if len(embeddings) < 4:
            return {"status": False, "message": f"Could only extract {len(embeddings)} of 4 embeddings. Errors: {', '.join(errors)}"}
        return {"status": True, "embeddings": embeddings, "message": "OK"}
    except Exception as e:
        return {"status": False, "message": f"Extract multiple failed: {str(e)}"}


def handle_compare(args):
    """Compare a live embedding against stored encrypted embeddings."""
    live_embedding = args.get("live_embedding")
    encrypted_embeddings = args.get("stored_embeddings")
    if not live_embedding or not encrypted_embeddings:
        return {"status": False, "message": "Missing live embedding or stored embeddings"}
    try:
        # Decrypt stored embeddings first
        stored_embeddings = decrypt_embeddings(encrypted_embeddings)
        is_match, score = face_service.compare_embeddings(live_embedding, stored_embeddings)
        return {"status": True, "isMatch": is_match, "score": score}
    except Exception as e:
        return {"status": False, "message": f"Comparison failed: {str(e)}"}


def handle_liveness_check(args):
    """Run full liveness check on 4 registration images."""
    images = args.get("images")
    if not images or len(images) < 4:
        return {"status": False, "message": "Expected exactly 4 images"}
    try:
        is_live, reason = face_service.perform_liveness_check(images)
        return {"status": True, "isLive": is_live, "message": reason}
    except Exception as e:
        return {"status": False, "message": f"Liveness check failed: {str(e)}"}


def handle_encrypt(args):
    """Encrypt face embeddings."""
    embeddings = args.get("embeddings")
    if not embeddings:
        return {"status": False, "message": "Missing embeddings"}
    try:
        encrypted = encrypt_embeddings(embeddings)
        return {"status": True, "encrypted_embeddings": encrypted}
    except Exception as e:
        return {"status": False, "message": f"Encryption failed: {str(e)}"}


def handle_decrypt(args):
    """Decrypt face embeddings."""
    encrypted = args.get("encrypted_embeddings")
    if not encrypted:
        return {"status": False, "message": "Missing encrypted embeddings"}
    try:
        decrypted = decrypt_embeddings(encrypted)
        return {"status": True, "embeddings": decrypted}
    except Exception as e:
        return {"status": False, "message": f"Decryption failed: {str(e)}"}


def main():
    """Main CLI entry point."""
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"status": False, "message": "Empty input"}))
            return

        payload = json.loads(input_data)
        action = payload.get("action")
        args = payload.get("args", {})

        handlers = {
            "validate_full_face": handle_validate_full_face,
            "temporal_liveness": handle_temporal_liveness,
            "extract_embedding": handle_extract_embedding,
            "extract_multiple": handle_extract_multiple,
            "compare": handle_compare,
            "liveness_check": handle_liveness_check,
            "encrypt": handle_encrypt,
            "decrypt": handle_decrypt,
        }

        if action not in handlers:
            print(json.dumps({"status": False, "message": f"Unknown action: {action}"}))
            return

        res = handlers[action](args)
        print(json.dumps(res))

    except Exception as e:
        print(json.dumps({"status": False, "message": f"CLI error: {str(e)}"}))


if __name__ == "__main__":
    main()
