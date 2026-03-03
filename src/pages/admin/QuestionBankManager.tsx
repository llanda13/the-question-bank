import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Save, X, Filter, FileText, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Questions, type Question } from "@/services/db/questions";
import {
  CATEGORIES,
  getSpecializations,
  getSubjectCodes,
  getSubjectDescription,
} from "@/config/questionBankFilters";
import { QuestionBankReports } from "@/components/admin/QuestionBankReports";

export default function QuestionBankManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<"questions" | "reports">("questions");
  const queryClient = useQueryClient();

  // Cascading filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSpecialization, setFilterSpecialization] = useState<string>("all");
  const [filterSubjectCode, setFilterSubjectCode] = useState<string>("all");
  const [filterSubjectDescription, setFilterSubjectDescription] = useState<string>("");

  const [formData, setFormData] = useState({
    question_text: "",
    question_type: "mcq" as const,
    choices: [] as any[],
    correct_answer: "",
    topic: "",
    bloom_level: "",
    difficulty: "",
    subject: "",
    grade_level: "",
    cognitive_level: "",
    knowledge_dimension: "",
    category: "",
    specialization: "",
    subject_code: "",
    subject_description: "",
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Question[];
    },
  });

  // Derived specialization options based on selected category
  const specializationOptions = useMemo(() => {
    if (filterCategory === "all") return [];
    return getSpecializations(filterCategory);
  }, [filterCategory]);

  // Derived subject code options based on selected specialization
  const subjectCodeOptions = useMemo(() => {
    if (filterCategory === "all" || filterSpecialization === "all") return [];
    return getSubjectCodes(filterCategory, filterSpecialization);
  }, [filterCategory, filterSpecialization]);

  // Auto-populate subject description when subject code changes
  const computedSubjectDescription = useMemo(() => {
    if (filterCategory === "all" || filterSpecialization === "all" || filterSubjectCode === "all") return "";
    return getSubjectDescription(filterCategory, filterSpecialization, filterSubjectCode);
  }, [filterCategory, filterSpecialization, filterSubjectCode]);

  // Cascading reset handlers
  const handleCategoryChange = (value: string) => {
    setFilterCategory(value);
    setFilterSpecialization("all");
    setFilterSubjectCode("all");
    setFilterSubjectDescription("");
  };

  const handleSpecializationChange = (value: string) => {
    setFilterSpecialization(value);
    setFilterSubjectCode("all");
    setFilterSubjectDescription("");
  };

  const handleSubjectCodeChange = (value: string) => {
    setFilterSubjectCode(value);
    if (value !== "all" && filterCategory !== "all" && filterSpecialization !== "all") {
      setFilterSubjectDescription(getSubjectDescription(filterCategory, filterSpecialization, value));
    } else {
      setFilterSubjectDescription("");
    }
  };

  // Filter + search
  const filteredQuestions = useMemo(() => {
    if (!questions) return [];
    let result = [...questions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.question_text.toLowerCase().includes(q) ||
          item.topic?.toLowerCase().includes(q) ||
          item.subject?.toLowerCase().includes(q) ||
          (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (filterCategory !== "all") {
      result = result.filter((q) => (q as any).category === filterCategory);
    }
    if (filterSpecialization !== "all") {
      result = result.filter((q) => (q as any).specialization === filterSpecialization);
    }
    if (filterSubjectCode !== "all") {
      result = result.filter((q) => (q as any).subject_code === filterSubjectCode);
    }

    return result;
  }, [questions, searchQuery, filterCategory, filterSpecialization, filterSubjectCode]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await Questions.create({
        ...data,
        created_by: "admin",
        approved: true,
        status: "approved",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      toast.success("Question created successfully");
      resetForm();
    },
    onError: () => toast.error("Failed to create question"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return await Questions.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      toast.success("Question updated");
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("Failed to update question"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => Questions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      toast.success("Question deleted");
    },
    onError: () => toast.error("Failed to delete question"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => Questions.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      setSelectedIds(new Set());
      toast.success(`Deleted ${selectedIds.size} questions`);
    },
    onError: () => toast.error("Bulk delete failed"),
  });

  const resetForm = () => {
    setFormData({
      question_text: "",
      question_type: "mcq",
      choices: [],
      correct_answer: "",
      topic: "",
      bloom_level: "",
      difficulty: "",
      subject: "",
      grade_level: "",
      cognitive_level: "",
      knowledge_dimension: "",
      category: "",
      specialization: "",
      subject_code: "",
      subject_description: "",
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const handleEdit = (question: Question) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type as any,
      choices: (question.choices as any[]) || [],
      correct_answer: question.correct_answer || "",
      topic: question.topic,
      bloom_level: question.bloom_level || "",
      difficulty: question.difficulty || "",
      subject: question.subject || "",
      grade_level: question.grade_level || "",
      cognitive_level: question.cognitive_level || "",
      knowledge_dimension: question.knowledge_dimension || "",
      category: (question as any).category || "",
      specialization: (question as any).specialization || "",
      subject_code: (question as any).subject_code || "",
      subject_description: (question as any).subject_description || "",
    });
  };

  const handleSubmit = () => {
    if (editingId) updateMutation.mutate({ id: editingId, data: formData });
    else createMutation.mutate(formData);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
  };

  const clearFilters = () => {
    setFilterCategory("all");
    setFilterSpecialization("all");
    setFilterSubjectCode("all");
    setFilterSubjectDescription("");
    setSearchQuery("");
  };

  const activeFilterCount = [filterCategory, filterSpecialization, filterSubjectCode].filter(
    (f) => f !== "all"
  ).length;

  const formatTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.toLocaleString("default", { month: "short" });
    return `${month} ${d.getFullYear()}`;
  };

  const renderQuestionCard = (q: Question) => {
    const qAny = q as any;
    return (
      <div
        key={q.id}
        className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
      >
        <Checkbox
          checked={selectedIds.has(q.id)}
          onCheckedChange={() => toggleSelect(q.id)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {q.question_text}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {qAny.category && (
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                {qAny.category}
              </Badge>
            )}
            {qAny.specialization && (
              <Badge variant="secondary" className="text-xs">
                {qAny.specialization}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {formatTimestamp(q.created_at)}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={() => handleEdit(q)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive"
            onClick={() => deleteMutation.mutate(q.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Question Bank Manager</h1>
          <p className="text-muted-foreground">Full CRUD access to master question repository</p>
        </div>
        <Button onClick={() => setIsCreating(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Question" : "Create New Question"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Textarea
                value={formData.question_text}
                onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, category: v, specialization: "", subject_code: "", subject_description: "" })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Select
                  value={formData.specialization}
                  onValueChange={(v) =>
                    setFormData({ ...formData, specialization: v, subject_code: "", subject_description: "" })
                  }
                  disabled={!formData.category}
                >
                  <SelectTrigger><SelectValue placeholder="Select specialization" /></SelectTrigger>
                  <SelectContent>
                    {formData.category &&
                      getSpecializations(formData.category).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject Code</Label>
                <Select
                  value={formData.subject_code}
                  onValueChange={(v) => {
                    const desc = getSubjectDescription(formData.category, formData.specialization, v);
                    setFormData({ ...formData, subject_code: v, subject_description: desc });
                  }}
                  disabled={!formData.specialization}
                >
                  <SelectTrigger><SelectValue placeholder="Select code" /></SelectTrigger>
                  <SelectContent>
                    {formData.category &&
                      formData.specialization &&
                      getSubjectCodes(formData.category, formData.specialization).map((s) => (
                        <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject Description</Label>
                <Input value={formData.subject_description} readOnly className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Topic</Label>
                <Input value={formData.topic} onChange={(e) => setFormData({ ...formData, topic: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bloom's Level</Label>
                <Select value={formData.bloom_level} onValueChange={(v) => setFormData({ ...formData, bloom_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Create"}
              </Button>
              <Button onClick={resetForm} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Filter Panel */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{activeFilterCount}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category */}
              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <Select value={filterCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specialization - dependent on Category */}
              <div className="space-y-2">
                <Label className="text-xs">Specialization</Label>
                <Select
                  value={filterSpecialization}
                  onValueChange={handleSpecializationChange}
                  disabled={filterCategory === "all"}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specializations</SelectItem>
                    {specializationOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Code - dependent on Specialization */}
              <div className="space-y-2">
                <Label className="text-xs">Subject Code</Label>
                <Select
                  value={filterSubjectCode}
                  onValueChange={handleSubjectCodeChange}
                  disabled={filterSpecialization === "all"}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Codes</SelectItem>
                    {subjectCodeOptions.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Description - auto-populated */}
              {computedSubjectDescription && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Subject Description</Label>
                  <p className="text-xs font-medium p-2 rounded bg-muted border">
                    {computedSubjectDescription}
                  </p>
                </div>
              )}

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-3">
          {/* Search + View Toggle Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions, topics, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeView === "questions" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveView("questions")}
                className="gap-1.5"
              >
                <FileText className="h-4 w-4" />
                Questions
              </Button>
              <Button
                variant={activeView === "reports" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveView("reports")}
                className="gap-1.5"
              >
                <BarChart3 className="h-4 w-4" />
                Reports
              </Button>
            </div>
          </div>

          {activeView === "reports" ? (
            <QuestionBankReports questions={filteredQuestions} />
          ) : (
            <>
              {/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
                  <span className="text-sm font-medium">{selectedIds.size} selected</span>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => bulkDeleteMutation.mutate([...selectedIds])}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              )}

              {/* Results count + select all */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filteredQuestions.length > 0 && selectedIds.size === filteredQuestions.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span>{filteredQuestions.length} questions</span>
                </div>
              </div>

              {/* Questions Display */}
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading questions...</div>
              ) : filteredQuestions.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    No questions found.{" "}
                    {activeFilterCount > 0 ? "Try adjusting your filters." : "Create your first question!"}
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-2 pr-4">{filteredQuestions.map(renderQuestionCard)}</div>
                </ScrollArea>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
