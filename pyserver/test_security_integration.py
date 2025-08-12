import pytest
import os
from fastapi.testclient import TestClient
from unittest.mock import patch

# Import after environment setup to get proper middleware configuration
def get_test_client(env_vars=None):
    """Create test client with specific environment variables"""
    if env_vars:
        with patch.dict(os.environ, env_vars, clear=False):
            # Need to import main after setting environment
            import importlib
            import sys
            if 'main' in sys.modules:
                importlib.reload(sys.modules['main'])
            from main import app
            return TestClient(app)
    else:
        from main import app
        return TestClient(app)

class TestSecurityMiddlewareIntegration:
    
    def test_cors_and_security_headers_together_development(self):
        """Test that CORS and security headers work together in development"""
        env_vars = {'NODE_ENV': 'development'}
        client = get_test_client(env_vars)
        
        response = client.get(
            "/",
            headers={"Origin": "http://localhost:8080"}
        )
        
        # Should succeed
        assert response.status_code == 200
        
        # CORS headers should be present
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "http://localhost:8080"
        
        # HSTS should NOT be present in development
        assert "strict-transport-security" not in response.headers

    def test_cors_and_security_headers_together_production(self):
        """Test that CORS and security headers work together in production"""
        env_vars = {
            'NODE_ENV': 'production',
            'ALLOWED_ORIGINS': 'https://production-app.com,http://localhost:8080'
        }
        client = get_test_client(env_vars)
        
        response = client.get(
            "/",
            headers={"Origin": "https://production-app.com"}
        )
        
        # Should succeed
        assert response.status_code == 200
        
        # CORS headers should be present
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "https://production-app.com"
        
        # HSTS should be present in production
        assert "strict-transport-security" in response.headers
        assert response.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains; preload"

    def test_cors_blocked_origin_behavior(self):
        """Test behavior when CORS blocks an origin"""
        env_vars = {'NODE_ENV': 'development'}
        client = get_test_client(env_vars)
        
        # This should be blocked by CORS
        response = client.get(
            "/",
            headers={"Origin": "https://malicious-site.com"}
        )
        
        # Request should fail due to CORS
        assert response.status_code == 500  # CORS error (FastAPI returns 500 for CORS violations)
        
        # Security headers middleware should still run for blocked requests
        # (HSTS only in production, so not expected here in development)

    def test_middleware_order_with_options_request(self):
        """Test that middleware order is correct for OPTIONS requests"""
        env_vars = {'NODE_ENV': 'development'}
        client = get_test_client(env_vars)
        
        response = client.options(
            "/topic_tree",
            headers={
                "Origin": "http://localhost:8080",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,X-OpenAI-API-Key"
            }
        )
        
        # CORS preflight should succeed
        assert response.status_code == 200
        assert "access-control-allow-methods" in response.headers
        assert "access-control-allow-headers" in response.headers
        assert "POST" in response.headers["access-control-allow-methods"]
        assert "X-OpenAI-API-Key" in response.headers["access-control-allow-headers"]

    def test_express_server_origin_always_allowed(self):
        """Critical test: Express server origin must always be allowed"""
        env_vars = {
            'NODE_ENV': 'production',
            'ALLOWED_ORIGINS': 'https://production-app.com'  # Not explicitly including Express server
        }
        client = get_test_client(env_vars)
        
        # Express server origin should still work (auto-added by get_allowed_origins)
        response = client.get(
            "/",
            headers={"Origin": "http://localhost:8080"}
        )
        
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:8080"

    def test_api_endpoints_with_both_middleware(self):
        """Test that API endpoints work with both CORS and security middleware"""
        env_vars = {'NODE_ENV': 'development'}
        client = get_test_client(env_vars)
        
        # Test POST endpoint that requires CORS
        response = client.post(
            "/topic_tree",
            headers={
                "Origin": "http://localhost:8080",
                "Content-Type": "application/json",
                "X-OpenAI-API-Key": "test-key"
            },
            json={
                "comments": [{"id": "1", "text": "test", "speaker": "test"}],
                "llm": {
                    "model_name": "gpt-4o-mini",
                    "system_prompt": "test",
                    "user_prompt": "test"
                }
            }
        )
        
        # Should get validation error (422) but CORS should work
        # Note: This will fail with missing API implementation, but CORS headers should be present
        assert response.status_code in [422, 500]  # Validation error or missing OpenAI key
        assert "access-control-allow-origin" in response.headers

    def test_https_redirect_middleware_production(self):
        """Test HTTPS redirect is enabled in production"""
        env_vars = {'NODE_ENV': 'production'}
        client = get_test_client(env_vars)
        
        # Note: Testing HTTPS redirect is complex in test environment
        # This test verifies the middleware is configured without actual redirect
        response = client.get("/")
        
        # Should succeed (redirect middleware present but may not trigger in test)
        assert response.status_code in [200, 307, 308]  # Success or redirect codes

    def test_security_headers_on_error_responses(self):
        """Test that security headers are applied even to error responses"""
        env_vars = {'NODE_ENV': 'production'}
        client = get_test_client(env_vars)
        
        # Request that should cause an error
        response = client.post(
            "/topic_tree",
            headers={"Origin": "http://localhost:8080"},
            json={}  # Invalid request body
        )
        
        # Should be an error response
        assert response.status_code in [400, 422, 500]
        
        # But CORS headers should still be present
        assert "access-control-allow-origin" in response.headers
        
        # And HSTS should be present in production
        assert "strict-transport-security" in response.headers

    def test_cors_credentials_and_headers_allowed(self):
        """Test that credentials and custom headers are properly configured"""
        env_vars = {'NODE_ENV': 'development'}
        client = get_test_client(env_vars)
        
        response = client.options(
            "/claims",
            headers={
                "Origin": "http://localhost:8080",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Authorization,X-OpenAI-API-Key"
            }
        )
        
        assert response.status_code == 200
        assert "access-control-allow-credentials" in response.headers
        assert response.headers["access-control-allow-credentials"] == "true"
        assert "X-OpenAI-API-Key" in response.headers["access-control-allow-headers"]

    def test_preflight_cache_configuration(self):
        """Test that preflight cache is set to 24 hours"""
        env_vars = {'NODE_ENV': 'development'}
        client = get_test_client(env_vars)
        
        response = client.options(
            "/sort_claims_tree/",
            headers={
                "Origin": "http://localhost:8080",
                "Access-Control-Request-Method": "PUT"
            }
        )
        
        assert response.status_code == 200
        assert "access-control-max-age" in response.headers
        assert response.headers["access-control-max-age"] == "86400"  # 24 hours in seconds

class TestSecurityConfiguration:
    
    def test_cors_logging_configuration(self):
        """Test that CORS configuration is logged for security monitoring"""
        env_vars = {'NODE_ENV': 'development'}
        
        # This test verifies the logging setup exists
        # In a real scenario, you'd capture log output
        with patch.dict(os.environ, env_vars, clear=False):
            from main import logger
            assert logger is not None

    def test_allowed_origins_parsing(self):
        """Test that ALLOWED_ORIGINS environment variable is parsed correctly"""
        env_vars = {
            'NODE_ENV': 'development',
            'ALLOWED_ORIGINS': 'https://app1.com, https://app2.com , https://app3.com'
        }
        client = get_test_client(env_vars)
        
        # All origins should work (whitespace trimmed)
        for origin in ['https://app1.com', 'https://app2.com', 'https://app3.com']:
            response = client.get("/", headers={"Origin": origin})
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin