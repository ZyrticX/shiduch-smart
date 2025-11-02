import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Plus, Edit, Trash2, ArrowRight, Power, PowerOff, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Volunteer {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string;
  native_language: string;
  gender: string | null;
  is_active: boolean;
  current_matches: number;
  capacity: number;
  created_at: string;
}

export default function Volunteers() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [cities, setCities] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  useEffect(() => {
    loadVolunteers();
  }, []);

  const loadVolunteers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("volunteers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("שגיאה בטעינת מתנדבים");
      console.error(error);
    } else {
      setVolunteers(data || []);
      
      const uniqueCities = [...new Set(data?.map(v => v.city) || [])];
      const uniqueLanguages = [...new Set(data?.map(v => v.native_language) || [])];
      setCities(uniqueCities);
      setLanguages(uniqueLanguages);
    }
    setLoading(false);
  };

  const filteredVolunteers = volunteers.filter((volunteer) => {
    const matchesSearch = 
      volunteer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      volunteer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (volunteer.phone && volunteer.phone.includes(searchTerm));
    
    const matchesCity = cityFilter === "all" || volunteer.city === cityFilter;
    const matchesLanguage = languageFilter === "all" || volunteer.native_language === languageFilter;
    const matchesCapacity = 
      capacityFilter === "all" || 
      (capacityFilter === "available" && volunteer.current_matches < volunteer.capacity) ||
      (capacityFilter === "full" && volunteer.current_matches >= volunteer.capacity);

    return matchesSearch && matchesCity && matchesLanguage && matchesCapacity;
  });

  const handleEdit = (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setIsNew(false);
    setDrawerOpen(true);
  };

  const handleNew = () => {
    setSelectedVolunteer({
      id: "",
      full_name: "",
      email: "",
      phone: "",
      city: "",
      native_language: "",
      gender: "",
      is_active: true,
      current_matches: 0,
      capacity: 1,
      created_at: new Date().toISOString(),
    });
    setIsNew(true);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selectedVolunteer) return;

    if (isNew) {
      const { error } = await supabase
        .from("volunteers")
        .insert({
          full_name: selectedVolunteer.full_name,
          email: selectedVolunteer.email,
          phone: selectedVolunteer.phone,
          city: selectedVolunteer.city,
          native_language: selectedVolunteer.native_language,
          gender: selectedVolunteer.gender,
          capacity: selectedVolunteer.capacity,
          is_active: selectedVolunteer.is_active,
        });

      if (error) {
        toast.error("שגיאה בהוספת מתנדב");
        console.error(error);
      } else {
        toast.success("מתנדב נוסף בהצלחה");
        loadVolunteers();
        setDrawerOpen(false);
      }
    } else {
      const { error } = await supabase
        .from("volunteers")
        .update({
          full_name: selectedVolunteer.full_name,
          email: selectedVolunteer.email,
          phone: selectedVolunteer.phone,
          city: selectedVolunteer.city,
          native_language: selectedVolunteer.native_language,
          gender: selectedVolunteer.gender,
          capacity: selectedVolunteer.capacity,
          is_active: selectedVolunteer.is_active,
        })
        .eq("id", selectedVolunteer.id);

      if (error) {
        toast.error("שגיאה בעדכון מתנדב");
        console.error(error);
      } else {
        toast.success("מתנדב עודכן בהצלחה");
        loadVolunteers();
        setDrawerOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק מתנדב זה?")) return;

    const { error } = await supabase
      .from("volunteers")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה במחיקת מתנדב");
      console.error(error);
    } else {
      toast.success("מתנדב נמחק בהצלחה");
      loadVolunteers();
    }
  };

  const handleBulkActivate = async () => {
    if (selectedIds.length === 0) {
      toast.error("לא נבחרו מתנדבים");
      return;
    }

    const { error } = await supabase
      .from("volunteers")
      .update({ is_active: true })
      .in("id", selectedIds);

    if (error) {
      toast.error("שגיאה בהפעלת מתנדבים");
      console.error(error);
    } else {
      toast.success(`${selectedIds.length} מתנדבים הופעלו`);
      setSelectedIds([]);
      loadVolunteers();
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) {
      toast.error("לא נבחרו מתנדבים");
      return;
    }

    const { error } = await supabase
      .from("volunteers")
      .update({ is_active: false })
      .in("id", selectedIds);

    if (error) {
      toast.error("שגיאה בהשהיית מתנדבים");
      console.error(error);
    } else {
      toast.success(`${selectedIds.length} מתנדבים הושהו`);
      setSelectedIds([]);
      loadVolunteers();
    }
  };

  const handleBulkResetCapacity = async () => {
    if (selectedIds.length === 0) {
      toast.error("לא נבחרו מתנדבים");
      return;
    }

    const { error } = await supabase
      .from("volunteers")
      .update({ current_matches: 0 })
      .in("id", selectedIds);

    if (error) {
      toast.error("שגיאה באיפוס קיבולת");
      console.error(error);
    } else {
      toast.success(`קיבולת של ${selectedIds.length} מתנדבים אופסה`);
      setSelectedIds([]);
      loadVolunteers();
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVolunteers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVolunteers.map(v => v.id));
    }
  };

  return (
    <div className="min-h-screen bg-background p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">ניהול מתנדבים</h1>
            <p className="text-muted-foreground mt-2">
              {filteredVolunteers.length} מתנדבים מתוך {volunteers.length}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה לדף הראשי
            </Button>
            <Button onClick={handleNew}>
              <Plus className="ml-2 h-4 w-4" />
              הוסף מתנדב
            </Button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.length} מתנדבים נבחרו
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleBulkActivate}>
                  <Power className="ml-2 h-4 w-4" />
                  הפעל
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkDeactivate}>
                  <PowerOff className="ml-2 h-4 w-4" />
                  השהה
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkResetCapacity}>
                  <RotateCcw className="ml-2 h-4 w-4" />
                  אפס קיבולת
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
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
            <Select value={capacityFilter} onValueChange={setCapacityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="סנן לפי זמינות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="available">זמין</SelectItem>
                <SelectItem value="full">מלא</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-12">
                  <Checkbox
                    checked={selectedIds.length === filteredVolunteers.length && filteredVolunteers.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-right">שם מלא</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right">עיר</TableHead>
                <TableHead className="text-right">שפת אם</TableHead>
                <TableHead className="text-right">קיבולת</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    טוען...
                  </TableCell>
                </TableRow>
              ) : filteredVolunteers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    לא נמצאו מתנדבים
                  </TableCell>
                </TableRow>
              ) : (
                filteredVolunteers.map((volunteer) => (
                  <TableRow key={volunteer.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(volunteer.id)}
                        onCheckedChange={() => toggleSelection(volunteer.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{volunteer.full_name}</TableCell>
                    <TableCell>{volunteer.email}</TableCell>
                    <TableCell>{volunteer.phone || "-"}</TableCell>
                    <TableCell>{volunteer.city}</TableCell>
                    <TableCell>{volunteer.native_language}</TableCell>
                    <TableCell>
                      <span className={`font-medium ${
                        volunteer.current_matches >= volunteer.capacity ? "text-red-600" : "text-green-600"
                      }`}>
                        {volunteer.current_matches} / {volunteer.capacity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 rounded text-xs ${
                        volunteer.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}>
                        {volunteer.is_active ? "פעיל" : "מושהה"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(volunteer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(volunteer.id)}>
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

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{isNew ? "הוסף מתנדב חדש" : "ערוך מתנדב"}</DrawerTitle>
          </DrawerHeader>
          <div className="p-6 space-y-4" dir="rtl">
            <div>
              <Label>שם מלא</Label>
              <Input
                value={selectedVolunteer?.full_name || ""}
                onChange={(e) => setSelectedVolunteer(prev => prev ? {...prev, full_name: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>אימייל</Label>
              <Input
                type="email"
                value={selectedVolunteer?.email || ""}
                onChange={(e) => setSelectedVolunteer(prev => prev ? {...prev, email: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>טלפון</Label>
              <Input
                value={selectedVolunteer?.phone || ""}
                onChange={(e) => setSelectedVolunteer(prev => prev ? {...prev, phone: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>עיר</Label>
              <Input
                value={selectedVolunteer?.city || ""}
                onChange={(e) => setSelectedVolunteer(prev => prev ? {...prev, city: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>שפת אם</Label>
              <Input
                value={selectedVolunteer?.native_language || ""}
                onChange={(e) => setSelectedVolunteer(prev => prev ? {...prev, native_language: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>מין</Label>
              <Select
                value={selectedVolunteer?.gender || ""}
                onValueChange={(value) => setSelectedVolunteer(prev => prev ? {...prev, gender: value} : null)}
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
              <Label>קיבולת מקסימלית</Label>
              <Input
                type="number"
                min="1"
                value={selectedVolunteer?.capacity || 1}
                onChange={(e) => setSelectedVolunteer(prev => prev ? {...prev, capacity: parseInt(e.target.value)} : null)}
              />
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="is_active"
                checked={selectedVolunteer?.is_active || false}
                onCheckedChange={(checked) => setSelectedVolunteer(prev => prev ? {...prev, is_active: checked as boolean} : null)}
              />
              <Label htmlFor="is_active">מתנדב פעיל</Label>
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
