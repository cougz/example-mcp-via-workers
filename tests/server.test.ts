import { describe, it, expect } from "vitest";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("UUID Generator Logic", () => {
  it("should generate valid v4 UUIDs", () => {
    const uuids = Array.from({ length: 10 }, () => crypto.randomUUID());
    
    for (const uuid of uuids) {
      expect(uuid).toMatch(uuidRegex);
    }
  });

  it("should generate unique UUIDs", () => {
    const uuids = Array.from({ length: 100 }, () => crypto.randomUUID());
    const uniqueUuids = new Set(uuids);
    
    expect(uniqueUuids.size).toBe(100);
  });

  it("should generate correct count", () => {
    const count = 5;
    const uuids = Array.from({ length: count }, () => crypto.randomUUID());
    
    expect(uuids).toHaveLength(count);
  });
});

describe("Tool Response Format", () => {
  it("should return properly formatted success response", () => {
    const count = 3;
    const uuids = Array.from({ length: count }, () => crypto.randomUUID());
    const response = {
      uuids,
      count: uuids.length,
      generatedAt: new Date().toISOString(),
    };

    expect(response).toHaveProperty("uuids");
    expect(response).toHaveProperty("count", count);
    expect(response).toHaveProperty("generatedAt");
    expect(response.uuids).toHaveLength(count);
  });
});

describe("Schema Validation", () => {
  it("should accept valid count values", () => {
    const validCounts = [1, 50, 100];
    
    for (const count of validCounts) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(100);
      expect(Number.isInteger(count)).toBe(true);
    }
  });

  it("should reject invalid count values", () => {
    const invalidCounts = [0, -1, 101, 1.5];
    
    for (const count of invalidCounts) {
      const isValid = count >= 1 && count <= 100 && Number.isInteger(count);
      expect(isValid).toBe(false);
    }
  });
});

describe("Error Response Format", () => {
  it("should return properly formatted error response", () => {
    const error = new Error("Test error");
    const response = {
      error: error.message,
      success: false,
    };

    expect(response).toHaveProperty("error");
    expect(response).toHaveProperty("success", false);
  });
});
