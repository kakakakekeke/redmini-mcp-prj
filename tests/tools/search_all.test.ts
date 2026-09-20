import { describe, it, expect, vi } from "vitest";
import { searchAllSchema, searchAllHandler } from "../../src/tools/search_all.js";

describe("search_all tool", () => {
  describe("Schema Validation", () => {
    it("should validate valid parameters", () => {
      const args = {
        q: "release",
        scope: "all",
        open_issues: true,
        all_words: true,
        titles_only: false,
        issues: true,
        wiki_pages: true,
        news: false,
        documents: false,
        changesets: false,
        messages: false,
        projects: false,
        limit: 20,
        offset: 10,
      };
      const parsed = searchAllSchema.parse(args);
      expect(parsed.q).toBe("release");
      expect(parsed.scope).toBe("all");
      expect(parsed.open_issues).toBe(true);
      expect(parsed.all_words).toBe(true);
      expect(parsed.titles_only).toBe(false);
      expect(parsed.issues).toBe(true);
      expect(parsed.wiki_pages).toBe(true);
      expect(parsed.limit).toBe(20);
      expect(parsed.offset).toBe(10);
    });

    it("should apply default limit of 10 and offset of 0 if not provided", () => {
      const args = { q: "test" };
      const parsed = searchAllSchema.parse(args);
      expect(parsed.limit).toBe(10);
      expect(parsed.offset).toBe(0);
    });

    it("should reject missing query (q)", () => {
      expect(() => searchAllSchema.parse({})).toThrow();
    });

    it("should reject query exceeding 100 characters", () => {
      const longQuery = "a".repeat(101);
      expect(() => searchAllSchema.parse({ q: longQuery })).toThrow(/Query too long/);
    });

    it("should reject invalid scope", () => {
      expect(() => searchAllSchema.parse({ q: "test", scope: "invalid_scope" })).toThrow();
    });

    it("should reject limit exceeding 100", () => {
      expect(() => searchAllSchema.parse({ q: "test", limit: 101 })).toThrow(/Limit must be at most 100/);
    });

    it("should reject negative limit", () => {
      expect(() => searchAllSchema.parse({ q: "test", limit: 0 })).toThrow();
    });

    it("should reject negative offset", () => {
      expect(() => searchAllSchema.parse({ q: "test", offset: -1 })).toThrow();
    });
  });

  describe("Handler Logic", () => {
    it("should call RedmineClient.searchAll with correct parameters and return results", async () => {
      const mockResult = {
        results: [
          {
            id: 101,
            title: "Issue #101: Release planning",
            type: "issue",
            url: "http://localhost/issues/101",
            description: "Planning document for 1.0 release",
            datetime: "2026-09-20T10:00:00Z",
          },
        ],
        total_count: 1,
        offset: 0,
        limit: 10,
      };

      const mockClient = {
        searchAll: vi.fn().mockResolvedValue(mockResult),
      };

      const args = {
        q: "Release planning",
        scope: "my_projects" as const,
        open_issues: true,
        issues: true,
        wiki_pages: true,
        limit: 10,
        offset: 0,
      };

      const parsedArgs = searchAllSchema.parse(args);
      const result = await searchAllHandler(parsedArgs, mockClient as any);

      expect(mockClient.searchAll).toHaveBeenCalledWith({
        q: "Release planning",
        scope: "my_projects",
        open_issues: true,
        all_words: undefined,
        titles_only: undefined,
        issues: true,
        wiki_pages: true,
        news: undefined,
        documents: undefined,
        changesets: undefined,
        messages: undefined,
        projects: undefined,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual(mockResult);
    });
  });
});
