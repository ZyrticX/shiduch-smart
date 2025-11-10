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
import { Search, Plus, Edit, Trash2, ArrowRight, Power, PowerOff, RotateCcw, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserMatchesCard from "@/components/UserMatchesCard";

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string;
  native_language: string;
  gender: string | null;
  is_active: boolean;
  scholarship_active: boolean;
  current_students: number;
  capacity_max: number;
  created_at: string;
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardUser, setCardUser] = useState<User | null>(null);

  const [cities, setCities] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("שגיאה בטעינת משתמשים");
      console.error(error);
    } else {
      setUsers(data || []);
      
      const uniqueCities = [...new Set(data?.map(u => u.city) || [])];
      const uniqueLanguages = [...new Set(data?.map(u => u.native_language) || [])];
      setCities(uniqueCities);
      setLanguages(uniqueLanguages);
    }
    setLoading(false);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone && user.phone.includes(searchTerm));
    
    const matchesCity = cityFilter === "all" || user.city === cityFilter;
    const matchesLanguage = languageFilter === "all" || user.native_language === languageFilter;
    const matchesCapacity = 
      capacityFilter === "all" || 
      (capacityFilter === "available" && user.current_students < user.capacity_max) ||
      (capacityFilter === "full" && user.current_students >= user.capacity_max);

    return matchesSearch && matchesCity && matchesLanguage && matchesCapacity;
  });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsNew(false);
    setDrawerOpen(true);
  };

  const handleNew = () => {
    setSelectedUser({
      id: "",
      full_name: "",
      email: "",
      phone: "",
      city: "",
      native_language: "",
      gender: "",
      is_active: true,
      scholarship_active: true,
      current_students: 0,
      capacity_max: 1,
      created_at: new Date().toISOString(),
    });
    setIsNew(true);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    if (isNew) {
      const { error } = await supabase
        .from("users")
        .insert({
          full_name: selectedUser.full_name,
          email: selectedUser.email,
          phone: selectedUser.phone,
          city: selectedUser.city,
          native_language: selectedUser.native_language,
          gender: selectedUser.gender,
          capacity_max: selectedUser.capacity_max,
          scholarship_active: selectedUser.scholarship_active,
          is_active: selectedUser.is_active,
        });

      if (error) {
        toast.error("שגיאה בהוספת משתמש");
        console.error(error);
      } else {
        toast.success("משתמש נוסף בהצלחה");
        loadUsers();
        setDrawerOpen(false);
      }
    } else {
      const { error } = await supabase
        .from("users")
        .update({
          full_name: selectedUser.full_name,
          email: selectedUser.email,
          phone: selectedUser.phone,
          city: selectedUser.city,
          native_language: selectedUser.native_language,
          gender: selectedUser.gender,
          capacity_max: selectedUser.capacity_max,
          scholarship_active: selectedUser.scholarship_active,
          is_active: selectedUser.is_active,
        })
        .eq("id", selectedUser.id);

      if (error) {
        toast.error("שגיאה בעדכון משתמש");
        console.error(error);
      } else {
        toast.success("משתמש עודכן בהצלחה");
        loadUsers();
        setDrawerOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק משתמש זה?")) return;

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה במחיקת משתמש");
      console.error(error);
    } else {
      toast.success("משתמש נמחק בהצלחה");
      loadUsers();
    }
  };

  const handleBulkActivate = async () => {
    if (selectedIds.length === 0) {
      toast.error("לא נבחרו משתמשים");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ is_active: true })
      .in("id", selectedIds);

    if (error) {
      toast.error("שגיאה בהפעלת משתמשים");
      console.error(error);
    } else {
      toast.success(`${selectedIds.length} משתמשים הופעלו`);
      setSelectedIds([]);
      loadUsers();
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) {
      toast.error("לא נבחרו משתמשים");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ is_active: false })
      .in("id", selectedIds);

    if (error) {
      toast.error("שגיאה בהשהיית משתמשים");
      console.error(error);
    } else {
      toast.success(`${selectedIds.length} משתמשים הושהו`);
      setSelectedIds([]);
      loadUsers();
    }
  };

  const handleBulkResetCapacity = async () => {
    if (selectedIds.length === 0) {
      toast.error("לא נבחרו משתמשים");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ current_students: 0 })
      .in("id", selectedIds);

    if (error) {
      toast.error("שגיאה באיפוס קיבולת");
      console.error(error);
    } else {
      toast.success(`קיבולת של ${selectedIds.length} משתמשים אופסה`);
      setSelectedIds([]);
      loadUsers();
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const handleViewCard = (user: User) => {
    setCardUser(user);
    setCardOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 lg:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">ניהול משתמשים</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {filteredUsers.length} משתמשים מתוך {users.length}
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
              הוסף משתמש
            </Button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm border p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <span className="text-sm font-medium">
                {selectedIds.length} משתמשים נבחרו
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button size="sm" variant="outline" onClick={handleBulkActivate} className="flex-1 sm:flex-initial">
                  <Power className="ml-2 h-4 w-4" />
                  הפעל
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkDeactivate} className="flex-1 sm:flex-initial">
                  <PowerOff className="ml-2 h-4 w-4" />
                  השהה
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkResetCapacity} className="flex-1 sm:flex-initial">
                  <RotateCcw className="ml-2 h-4 w-4" />
                  אפס קיבולת
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-12 whitespace-nowrap">
                    <Checkbox
                      checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">שם מלא</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">אימייל</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden md:table-cell">טלפון</TableHead>
                  <TableHead className="text-right whitespace-nowrap">עיר</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">שפת אם</TableHead>
                  <TableHead className="text-right whitespace-nowrap">קיבולת</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden md:table-cell">מלגה פעילה</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">סטטוס</TableHead>
                  <TableHead className="text-right whitespace-nowrap">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      טוען...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      לא נמצאו משתמשים
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(user.id)}
                          onCheckedChange={() => toggleSelection(user.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => handleViewCard(user)}
                          className="hover:underline text-green-600 hover:text-green-800 transition-colors"
                        >
                          {user.full_name}
                        </button>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{user.phone || "-"}</TableCell>
                      <TableCell>{user.city}</TableCell>
                      <TableCell className="hidden lg:table-cell">{user.native_language}</TableCell>
                      <TableCell>
                        <span className={`font-medium text-xs sm:text-sm ${
                          user.current_students >= user.capacity_max ? "text-red-600" : "text-green-600"
                        }`}>
                          {user.current_students} / {user.capacity_max}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`inline-flex px-2 py-1 rounded text-xs ${
                          user.scholarship_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {user.scholarship_active ? "כן" : "לא"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={`inline-flex px-2 py-1 rounded text-xs ${
                          user.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {user.is_active ? "פעיל" : "מושהה"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => handleViewCard(user)} title="צפה בכרטיס">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(user)} title="ערוך">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)} title="מחק">
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
            <DrawerTitle>{isNew ? "הוסף משתמש חדש" : "ערוך משתמש"}</DrawerTitle>
          </DrawerHeader>
          <div className="p-6 space-y-4" dir="rtl">
            <div>
              <Label>שם מלא</Label>
              <Input
                value={selectedUser?.full_name || ""}
                onChange={(e) => setSelectedUser(prev => prev ? {...prev, full_name: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>אימייל</Label>
              <Input
                type="email"
                value={selectedUser?.email || ""}
                onChange={(e) => setSelectedUser(prev => prev ? {...prev, email: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>טלפון</Label>
              <Input
                value={selectedUser?.phone || ""}
                onChange={(e) => setSelectedUser(prev => prev ? {...prev, phone: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>עיר</Label>
              <Input
                value={selectedUser?.city || ""}
                onChange={(e) => setSelectedUser(prev => prev ? {...prev, city: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>שפת אם</Label>
              <Input
                value={selectedUser?.native_language || ""}
                onChange={(e) => setSelectedUser(prev => prev ? {...prev, native_language: e.target.value} : null)}
              />
            </div>
            <div>
              <Label>מין</Label>
              <Select
                value={selectedUser?.gender || ""}
                onValueChange={(value) => setSelectedUser(prev => prev ? {...prev, gender: value} : null)}
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
                value={selectedUser?.capacity_max || 1}
                onChange={(e) => setSelectedUser(prev => prev ? {...prev, capacity_max: parseInt(e.target.value)} : null)}
              />
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="is_active"
                checked={selectedUser?.is_active || false}
                onCheckedChange={(checked) => setSelectedUser(prev => prev ? {...prev, is_active: checked as boolean} : null)}
              />
              <Label htmlFor="is_active">משתמש פעיל</Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="scholarship_active"
                checked={selectedUser?.scholarship_active || false}
                onCheckedChange={(checked) => setSelectedUser(prev => prev ? {...prev, scholarship_active: checked as boolean} : null)}
              />
              <Label htmlFor="scholarship_active">מלגה פעילה</Label>
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

      <UserMatchesCard
        user={cardUser}
        open={cardOpen}
        onOpenChange={setCardOpen}
      />
    </div>
  );
}
