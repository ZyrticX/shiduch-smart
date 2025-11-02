import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Student {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string;
  native_language: string;
  gender: string | null;
  special_requests: string | null;
  is_matched: boolean;
  created_at: string;
}

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [cities, setCities] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("שגיאה בטעינת סטודנטים");
      console.error(error);
    } else {
      setStudents(data || []);
      
      // Extract unique cities and languages
      const uniqueCities = [...new Set(data?.map(s => s.city) || [])];
      const uniqueLanguages = [...new Set(data?.map(s => s.native_language) || [])];
      setCities(uniqueCities);
      setLanguages(uniqueLanguages);
    }
    setLoading(false);
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.phone && student.phone.includes(searchTerm));
    
    const matchesCity = cityFilter === "all" || student.city === cityFilter;
    const matchesLanguage = languageFilter === "all" || student.native_language === languageFilter;

    return matchesSearch && matchesCity && matchesLanguage;
  });

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsNew(false);
    setDrawerOpen(true);
  };

  const handleNew = () => {
    setSelectedStudent({
      id: "",
      full_name: "",
      email: "",
      phone: "",
      city: "",
      native_language: "",
      gender: "",
      special_requests: "",
      is_matched: false,
      created_at: new Date().toISOString(),
    });
    setIsNew(true);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selectedStudent) return;

    if (isNew) {
      const { error } = await supabase
        .from("students")
        .insert({
          full_name: selectedStudent.full_name,
          email: selectedStudent.email,
          phone: selectedStudent.phone,
          city: selectedStudent.city,
          native_language: selectedStudent.native_language,
          gender: selectedStudent.gender,
          special_requests: selectedStudent.special_requests,
        });

      if (error) {
        toast.error("שגיאה בהוספת סטודנט");
        console.error(error);
      } else {
        toast.success("סטודנט נוסף בהצלחה");
        loadStudents();
        setDrawerOpen(false);
      }
    } else {
      const { error } = await supabase
        .from("students")
        .update({
          full_name: selectedStudent.full_name,
          email: selectedStudent.email,
          phone: selectedStudent.phone,
          city: selectedStudent.city,
          native_language: selectedStudent.native_language,
          gender: selectedStudent.gender,
          special_requests: selectedStudent.special_requests,
        })
        .eq("id", selectedStudent.id);

      if (error) {
        toast.error("שגיאה בעדכון סטודנט");
        console.error(error);
      } else {
        toast.success("סטודנט עודכן בהצלחה");
        loadStudents();
        setDrawerOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק סטודנט זה?")) return;

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה במחיקת סטודנט");
      console.error(error);
    } else {
      toast.success("סטודנט נמחק בהצלחה");
      loadStudents();
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 lg:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">ניהול סטודנטים</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {filteredStudents.length} סטודנטים מתוך {students.length}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => navigate("/")} variant="outline" className="flex-1 sm:flex-initial">
              <ArrowRight className="ml-2 h-4 w-4" />
              <span className="hidden sm:inline">חזרה לדף הראשי</span>
              <span className="sm:hidden">חזרה</span>
            </Button>
            <Button onClick={handleNew} className="flex-1 sm:flex-initial">
              <Plus className="ml-2 h-4 w-4" />
              הוסף סטודנט
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="sm:col-span-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי שם, אימייל או טלפון..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="סנן לפי עיר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל העיירות</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="סנן לפי שפה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל השפות</SelectItem>
                {languages.map(lang => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right whitespace-nowrap">שם מלא</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">אימייל</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden md:table-cell">טלפון</TableHead>
                  <TableHead className="text-right whitespace-nowrap">עיר</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">שפת אם</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">מין</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden md:table-cell">שובץ</TableHead>
                  <TableHead className="text-right whitespace-nowrap">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      טוען...
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      לא נמצאו סטודנטים
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{student.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{student.phone || "-"}</TableCell>
                      <TableCell>{student.city}</TableCell>
                      <TableCell className="hidden lg:table-cell">{student.native_language}</TableCell>
                      <TableCell className="hidden lg:table-cell">{student.gender || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`inline-flex px-2 py-1 rounded text-xs ${
                          student.is_matched ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {student.is_matched ? "כן" : "לא"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(student)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(student.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{isNew ? "הוסף סטודנט חדש" : "ערוך סטודנט"}</DrawerTitle>
          </DrawerHeader>
          <div className="p-6 space-y-4" dir="rtl">
            <div>
              <Label>שם מלא</Label>
              <Input
                value={selectedStudent?.full_name || ""}
                onChange={(e) => setSelectedStudent(prev => prev ? {...prev, full_name: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>אימייל</Label>
              <Input
                type="email"
                value={selectedStudent?.email || ""}
                onChange={(e) => setSelectedStudent(prev => prev ? {...prev, email: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>טלפון</Label>
              <Input
                value={selectedStudent?.phone || ""}
                onChange={(e) => setSelectedStudent(prev => prev ? {...prev, phone: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>עיר</Label>
              <Input
                value={selectedStudent?.city || ""}
                onChange={(e) => setSelectedStudent(prev => prev ? {...prev, city: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>שפת אם</Label>
              <Input
                value={selectedStudent?.native_language || ""}
                onChange={(e) => setSelectedStudent(prev => prev ? {...prev, native_language: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>מין</Label>
              <Select
                value={selectedStudent?.gender || ""}
                onValueChange={(value) => setSelectedStudent(prev => prev ? {...prev, gender: value} : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מין" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">זכר</SelectItem>
                  <SelectItem value="female">נקבה</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>בקשות מיוחדות</Label>
              <Textarea
                value={selectedStudent?.special_requests || ""}
                onChange={(e) => setSelectedStudent(prev => prev ? {...prev, special_requests: e.target.value} : null)}
                rows={3}
              />
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleSave}>שמור</Button>
            <DrawerClose asChild>
              <Button variant="outline">ביטול</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
