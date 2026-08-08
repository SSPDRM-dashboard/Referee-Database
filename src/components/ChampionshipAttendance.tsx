import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  arrayUnion,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Search,
  X,
  FileCheck,
  Building,
  Calendar,
  MapPin,
  Users,
  Award,
  AlertCircle,
  Paperclip,
  Check,
  ClipboardCheck,
} from "lucide-react";

export interface RefRosterItem {
  id: string;
  name: string;
  tmId: string;
  role: string;
  discipline?: string;
}

export interface ChampionshipAttendanceRecord {
  id?: string;
  championshipName: string;
  championshipType: "Kyorugi" | "Poomsae" | "Combined";
  championshipLevel?: string;
  championshipDate: string;
  location: string;
  refereeInChargeId: string;
  refereeInChargeName: string;
  refereeInChargeTMId: string;
  uploadedByUid: string;
  uploadedByName: string;
  uploadedAt: string;
  status: "Submitted" | "Verified" | "Archived";
  attendanceCount: number;
  remarks: string;
  fileName: string;
  fileType: string;
  fileData: string;
  refereesList: RefRosterItem[];
}

interface ChampionshipAttendanceProps {
  currentUser: any;
  isAdmin?: boolean;
}

export default function ChampionshipAttendance({
  currentUser,
  isAdmin = false,
}: ChampionshipAttendanceProps) {
  const [records, setRecords] = useState<ChampionshipAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Form states
  const [championshipName, setChampionshipName] = useState("");
  const [championshipType, setChampionshipType] = useState<
    "Kyorugi" | "Poomsae" | "Combined"
  >("Kyorugi");
  const [championshipLevel, setChampionshipLevel] = useState("District");
  const [championshipDate, setChampionshipDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [location, setLocation] = useState("");
  const [refereeInChargeName, setRefereeInChargeName] = useState("");
  const [refereeInChargeTMId, setRefereeInChargeTMId] = useState("");
  const [attendanceCount, setAttendanceCount] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");

  // File states
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    data: string;
  } | null>(null);

  // Roster list state
  const [rosterList, setRosterList] = useState<RefRosterItem[]>([]);
  const [tempRosterName, setTempRosterName] = useState("");
  const [tempRosterTMId, setTempRosterTMId] = useState("");
  const [tempRosterRole, setTempRosterRole] = useState("Corner Referee");

  // View Document Modal
  const [viewRecord, setViewRecord] = useState<ChampionshipAttendanceRecord | null>(
    null
  );
  const [viewRosterRecord, setViewRosterRecord] = useState<ChampionshipAttendanceRecord | null>(
    null
  );

  // Deletion and Verification action states
  const [recordToDelete, setRecordToDelete] = useState<ChampionshipAttendanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Experience Sync status state
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
    if (currentUser) {
      setRefereeInChargeName(currentUser.fullName || "");
      setRefereeInChargeTMId(currentUser.tmMembershipId || "");
    }
  }, [currentUser]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "championship_attendances")
      );
      const snap = await getDocs(q);
      const list: ChampionshipAttendanceRecord[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });

      // Sort descending by uploadedAt or date
      list.sort((a, b) => {
        const timeA = new Date(a.uploadedAt || a.championshipDate).getTime();
        const timeB = new Date(b.uploadedAt || b.championshipDate).getTime();
        return timeB - timeA;
      });

      setRecords(list);
    } catch (err) {
      console.error("Error fetching championship attendance records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please attach a smaller document.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (typeof evt.target?.result === "string") {
        setAttachedFile({
          name: file.name,
          type: file.type || "application/octet-stream",
          data: evt.target.result,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddRosterItem = () => {
    if (!tempRosterName.trim()) return;
    const newItem: RefRosterItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: tempRosterName.trim().toUpperCase(),
      tmId: tempRosterTMId.trim().toUpperCase(),
      role: tempRosterRole || "Referee",
    };
    setRosterList([...rosterList, newItem]);
    setTempRosterName("");
    setTempRosterTMId("");
    if (!attendanceCount || rosterList.length + 1 > Number(attendanceCount)) {
      setAttendanceCount(rosterList.length + 1);
    }
  };

  const handleRemoveRosterItem = (id: string) => {
    setRosterList(rosterList.filter((item) => item.id !== id));
  };

  const handleOpenUploadModal = () => {
    setSubmitError("");
    setSubmitSuccess("");
    setChampionshipName("");
    setChampionshipType("Kyorugi");
    setChampionshipDate(new Date().toISOString().split("T")[0]);
    setLocation("");
    setRefereeInChargeName(currentUser?.fullName || "");
    setRefereeInChargeTMId(currentUser?.tmMembershipId || "");
    setAttendanceCount("");
    setRemarks("");
    setAttachedFile(null);
    setRosterList([]);
    setIsUploadModalOpen(true);
  };

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!championshipName.trim()) {
      setSubmitError("Please specify the Championship Title / Name.");
      return;
    }
    if (!refereeInChargeName.trim()) {
      setSubmitError("Referee in Charge Name is required.");
      return;
    }
    if (!attachedFile) {
      setSubmitError("Please upload the signed attendance list document or photo.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newRecord: Omit<ChampionshipAttendanceRecord, "id"> = {
        championshipName: championshipName.trim(),
        championshipType,
        championshipLevel,
        championshipDate,
        location: location.trim(),
        refereeInChargeId: currentUser?.uid || "",
        refereeInChargeName: refereeInChargeName.trim().toUpperCase(),
        refereeInChargeTMId: refereeInChargeTMId.trim().toUpperCase(),
        uploadedByUid: currentUser?.uid || "",
        uploadedByName: currentUser?.fullName || "Referee in Charge",
        uploadedAt: new Date().toISOString(),
        status: "Submitted",
        attendanceCount: Number(attendanceCount) || rosterList.length || 0,
        remarks: remarks.trim(),
        fileName: attachedFile.name,
        fileType: attachedFile.type,
        fileData: attachedFile.data,
        refereesList: rosterList,
      };

      await addDoc(collection(db, "championship_attendances"), newRecord);

      setSubmitSuccess("Attendance list submitted successfully!");
      setTimeout(() => {
        setIsUploadModalOpen(false);
        fetchRecords();
      }, 1200);
    } catch (err: any) {
      console.error("Error submitting attendance list:", err);
      setSubmitError("Failed to submit attendance list: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (!recordToDelete || !recordToDelete.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "championship_attendances", recordToDelete.id));
      setRecords((prev) => prev.filter((r) => r.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete record:", err);
      alert("Failed to delete record: " + (err.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleVerify = async (record: ChampionshipAttendanceRecord) => {
    if (!record.id) return;
    setUpdatingStatusId(record.id);
    const newStatus = record.status === "Verified" ? "Submitted" : "Verified";
    try {
      await updateDoc(doc(db, "championship_attendances", record.id), {
        status: newStatus,
      });
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: newStatus } : r))
      );
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert("Failed to update status: " + (err.message || err));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Sync championship attendance directly to attending referees' experience history
  const handleSyncAttendanceToExperience = async (
    record: ChampionshipAttendanceRecord
  ) => {
    if (!record.id) return;
    if (
      !record.refereesList ||
      record.refereesList.length === 0
    ) {
      alert(
        "No referees were itemized in the roster for this attendance list. Edit or add roster items before syncing."
      );
      return;
    }

    if (
      !window.confirm(
        `Sync attendance of ${record.refereesList.length} referees directly to their profile experience history?`
      )
    ) {
      return;
    }

    setSyncingId(record.id);

    try {
      const year = new Date(record.championshipDate).getFullYear().toString();
      const expField =
        record.championshipType === "Poomsae"
          ? "poomsaeExperienceHistory"
          : "experienceHistory";

      let syncedCount = 0;

      // Get all users to match by TM ID or Name
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: any[] = [];
      usersSnap.forEach((d) => usersList.push({ id: d.id, ...d.data() }));

      for (const rosterItem of record.refereesList) {
        // Find matching user
        const matchedUser = usersList.find((u) => {
          if (
            rosterItem.tmId &&
            u.tmMembershipId &&
            u.tmMembershipId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ===
              rosterItem.tmId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
          ) {
            return true;
          }
          if (
            rosterItem.name &&
            u.fullName &&
            u.fullName.trim().toLowerCase() ===
              rosterItem.name.trim().toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (matchedUser) {
          const newExpEntry = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
            year,
            eventName: record.championshipName,
            level: record.championshipLevel || "National Level",
            location: record.location,
            role: rosterItem.role || "Referee",
          };

          await updateDoc(doc(db, "users", matchedUser.id), {
            [expField]: arrayUnion(newExpEntry),
          });
          syncedCount++;
        }
      }

      alert(
        `Successfully synced championship experience to ${syncedCount} matching referee profile(s)!`
      );
    } catch (err: any) {
      console.error("Sync error:", err);
      alert("Failed to sync experience: " + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const filteredRecords = records.filter((rec) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = rec.championshipName.toLowerCase().includes(query);
    const ricMatch = rec.refereeInChargeName.toLowerCase().includes(query);
    const locMatch = rec.location.toLowerCase().includes(query);
    const tmMatch = rec.refereeInChargeTMId.toLowerCase().includes(query);

    const matchesSearch = nameMatch || ricMatch || locMatch || tmMatch;
    const matchesType =
      typeFilter === "All" || rec.championshipType === typeFilter;

    return matchesSearch && matchesType;
  });

  const downloadFile = (rec: ChampionshipAttendanceRecord) => {
    if (!rec.fileData) return;
    const a = document.createElement("a");
    a.href = rec.fileData;
    a.download = rec.fileName || "Championship_Attendance_List";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Action Header */}
      <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-lg mb-1 uppercase tracking-tight">
            <ClipboardCheck size={22} className="text-primary" />
            <span>Championship Attendance Upload</span>
          </div>
          <p className="text-sm text-muted m-0">
            Official system log for Referees-in-Charge to upload and archive verified referee attendance lists following championship completion.
          </p>
        </div>

        <button
          onClick={handleOpenUploadModal}
          className="bg-primary text-white hover:bg-primary/90 transition-all font-bold text-sm px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shrink-0 shadow-md hover:shadow-lg cursor-pointer"
        >
          <Upload size={18} />
          <span>Upload Attendance List</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-border shadow-xs">
        <div className="relative flex-1 w-full">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            placeholder="Search by championship name, referee-in-charge, venue, or TM ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 text-sm rounded-lg border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-black"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            Discipline:
          </span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm font-semibold border border-border rounded-lg bg-white focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="All">All Disciplines</option>
            <option value="Kyorugi">Kyorugi</option>
            <option value="Poomsae">Poomsae</option>
            <option value="Combined">Combined</option>
          </select>
        </div>
      </div>

      {/* Attendance Records List / Table */}
      {loading ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center text-muted">
          Loading championship attendance lists...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center text-muted flex flex-col items-center justify-center min-h-[260px]">
          <FileText size={42} className="text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-primary mb-1">
            No Attendance Lists Found
          </h3>
          <p className="text-sm max-w-md text-muted mb-4">
            {searchQuery || typeFilter !== "All"
              ? "No championship attendance lists match your search filters."
              : "No championship attendance lists have been uploaded yet. Click 'Upload Attendance List' to add the first record."}
          </p>
          {!searchQuery && typeFilter === "All" && (
            <button
              onClick={handleOpenUploadModal}
              className="bg-primary text-white font-bold text-xs px-4 py-2 rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Upload size={14} />
              Upload Attendance List
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRecords.map((rec) => (
            <div
              key={rec.id}
              className="bg-white border border-border rounded-xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
                      rec.championshipType === "Kyorugi"
                        ? "bg-red-100 text-red-800 border border-red-200"
                        : rec.championshipType === "Poomsae"
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-purple-100 text-purple-800 border border-purple-200"
                    }`}
                  >
                    {rec.championshipType}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                      rec.status === "Verified"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {rec.status === "Verified" ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Clock size={12} />
                    )}
                    {rec.status}
                  </span>

                  <span className="text-xs text-muted font-medium flex items-center gap-1 ml-auto lg:ml-0">
                    <Calendar size={13} />
                    {rec.championshipDate}
                  </span>
                </div>

                <h3 className="text-base font-bold text-primary leading-tight uppercase tracking-tight m-0">
                  {rec.championshipName}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-xs text-gray-600 mt-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-primary shrink-0" />
                    <span className="truncate">
                      Venue: <strong>{rec.location || "N/A"}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-primary shrink-0" />
                    <span>
                      Referees Present:{" "}
                      <strong>
                        {rec.attendanceCount || rec.refereesList?.length || 0}{" "}
                        Referees
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Award size={13} className="text-primary shrink-0" />
                    <span className="truncate">
                      Referee in Charge:{" "}
                      <strong className="text-primary font-bold">
                        {rec.refereeInChargeName}
                      </strong>
                      {rec.refereeInChargeTMId && (
                        <span className="text-[10px] ml-1 opacity-80">
                          ({rec.refereeInChargeTMId})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {rec.remarks && (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded border border-gray-100 m-0 mt-1">
                    "{rec.remarks}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-5 shrink-0">
                {rec.fileData && (
                  <button
                    onClick={() => setViewRecord(rec)}
                    className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Preview Attendance Document"
                  >
                    <Eye size={14} />
                    <span>View File</span>
                  </button>
                )}

                {rec.fileData && (
                  <button
                    onClick={() => downloadFile(rec)}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Download File"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                )}

                {rec.refereesList && rec.refereesList.length > 0 && (
                  <button
                    onClick={() => setViewRosterRecord(rec)}
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users size={14} />
                    <span>Roster ({rec.refereesList.length})</span>
                  </button>
                )}

                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleToggleVerify(rec)}
                      disabled={updatingStatusId === rec.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                        rec.status === "Verified"
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                      title={
                        rec.status === "Verified"
                          ? "Mark as Unverified"
                          : "Verify Attendance List"
                      }
                    >
                      <CheckCircle size={14} />
                      <span>
                        {updatingStatusId === rec.id
                          ? "Updating..."
                          : rec.status === "Verified"
                          ? "Unverify"
                          : "Verify"}
                      </span>
                    </button>

                    {rec.refereesList && rec.refereesList.length > 0 && (
                      <button
                        onClick={() => handleSyncAttendanceToExperience(rec)}
                        disabled={syncingId === rec.id}
                        className="bg-purple-600 text-white hover:bg-purple-700 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Sync to referee experience profiles"
                      >
                        <FileCheck size={14} />
                        <span>
                          {syncingId === rec.id ? "Syncing..." : "Sync Exp"}
                        </span>
                      </button>
                    )}
                  </>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setRecordToDelete(rec)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                    title="Delete Record (Admin Only)"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UPLOAD ATTENDANCE MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-primary p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Upload size={20} />
                <h3 className="font-bold text-lg m-0 text-white uppercase tracking-tight">
                  Upload Championship Attendance List
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-white hover:text-gray-200 transition-colors p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitAttendance}
              className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-sm"
            >
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">
                    Championship Title / Event Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24th National Taekwondo Championship 2026"
                    value={championshipName}
                    onChange={(e) => setChampionshipName(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary uppercase font-medium"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">
                    Discipline *
                  </label>
                  <select
                    value={championshipType}
                    onChange={(e) =>
                      setChampionshipType(
                        e.target.value as "Kyorugi" | "Poomsae" | "Combined"
                      )
                    }
                    className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary font-bold bg-white"
                  >
                    <option value="Kyorugi">Kyorugi</option>
                    <option value="Poomsae">Poomsae</option>
                    <option value="Combined">Combined</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">
                    Level of Championship *
                  </label>
                  <select
                    value={championshipLevel}
                    onChange={(e) => setChampionshipLevel(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary font-bold bg-white"
                  >
                    <option value="District">District</option>
                    <option value="State">State</option>
                    <option value="National Level">National Level</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">
                    Championship Date *
                  </label>
                  <input
                    type="date"
                    value={championshipDate}
                    onChange={(e) => setChampionshipDate(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">
                    Venue / Location *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stadium Titiwangsa, Kuala Lumpur"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              {/* Referee in Charge Details */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-3">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={14} />
                  Referee In Charge Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted uppercase">
                      Referee In Charge Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DATO' KANAGARAJAN"
                      value={refereeInChargeName}
                      onChange={(e) => setRefereeInChargeName(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-border rounded text-xs font-bold uppercase"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted uppercase">
                      TM ID / Referee Serial No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TM-1002"
                      value={refereeInChargeTMId}
                      onChange={(e) => setRefereeInChargeTMId(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-border rounded text-xs font-bold uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* File Attachment Upload */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Signed Attendance List Document / Photo Scan *
                </label>
                <div className="border-2 border-dashed border-gray-300 hover:border-primary bg-gray-50 hover:bg-gray-100/80 transition-all rounded-xl p-5 text-center flex flex-col items-center justify-center cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*,application/pdf,.csv,.xlsx,.doc,.docx"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {attachedFile ? (
                    <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-border shadow-xs w-full max-w-md">
                      <FileCheck size={28} className="text-emerald-600 shrink-0" />
                      <div className="flex-1 text-left truncate">
                        <p className="font-bold text-xs text-primary truncate m-0">
                          {attachedFile.name}
                        </p>
                        <span className="text-[10px] text-muted uppercase">
                          {attachedFile.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedFile(null);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="text-gray-400 mb-2" />
                      <p className="font-bold text-xs text-primary m-0">
                        Click or drag file to attach Attendance Document
                      </p>
                      <p className="text-[11px] text-muted m-0 mt-0.5">
                        Supports PDF, Scanned Images (JPG/PNG), Excel / CSV files (Max 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Roster list builder */}
              <div className="border border-border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} />
                    Attending Referees Roster (Optional)
                  </span>
                  <span className="text-xs font-bold text-muted">
                    Total: {rosterList.length} Referees
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Referee Name"
                    value={tempRosterName}
                    onChange={(e) => setTempRosterName(e.target.value)}
                    className="px-2.5 py-1.5 border border-border rounded text-xs font-semibold uppercase sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="TM ID (e.g. TM-1002)"
                    value={tempRosterTMId}
                    onChange={(e) => setTempRosterTMId(e.target.value)}
                    className="px-2.5 py-1.5 border border-border rounded text-xs uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleAddRosterItem}
                    className="bg-primary text-white font-bold text-xs py-1.5 px-3 rounded hover:bg-primary/90 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {rosterList.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border border-border rounded bg-gray-50">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b border-border text-[11px] font-bold text-muted uppercase">
                          <th className="p-2">Name</th>
                          <th className="p-2">TM ID</th>
                          <th className="p-2">Role</th>
                          <th className="p-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rosterList.map((item) => (
                          <tr key={item.id} className="border-b border-gray-200">
                            <td className="p-2 font-bold uppercase">
                              {item.name}
                            </td>
                            <td className="p-2 font-mono text-primary font-bold">
                              {item.tmId || "-"}
                            </td>
                            <td className="p-2">{item.role}</td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveRosterItem(item.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Remarks / TD Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Attendance verified and signed by TD. All 18 referees attended full tournament."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted hover:text-black transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !attachedFile}
                  className="bg-primary text-white hover:bg-primary/90 px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Upload size={14} />
                  <span>
                    {isSubmitting
                      ? "Uploading..."
                      : "Submit Attendance List"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DOCUMENT PREVIEW MODAL */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <h3 className="font-bold text-sm text-white m-0 uppercase tracking-tight truncate max-w-md">
                  {viewRecord.championshipName} - Attendance File
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="text-white hover:text-gray-200 transition-colors p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-auto flex-1 flex flex-col items-center justify-center bg-gray-100 min-h-[350px]">
              {viewRecord.fileData?.startsWith("data:application/pdf") ? (
                <iframe
                  src={viewRecord.fileData}
                  className="w-full h-[65vh] rounded-lg border border-border bg-white shadow-sm"
                  title="Attendance PDF"
                />
              ) : viewRecord.fileData?.startsWith("data:image/") ? (
                <img
                  src={viewRecord.fileData}
                  alt="Attendance Scan"
                  className="max-w-full max-h-[65vh] object-contain rounded-lg border border-border bg-white shadow-md"
                />
              ) : (
                <div className="bg-white p-8 rounded-xl shadow-sm text-center flex flex-col items-center gap-3">
                  <FileCheck size={48} className="text-primary" />
                  <div>
                    <h4 className="font-bold text-base text-primary m-0">
                      {viewRecord.fileName}
                    </h4>
                    <p className="text-xs text-muted m-0 mt-1">
                      {viewRecord.fileType}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadFile(viewRecord)}
                    className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 mt-2"
                  >
                    <Download size={16} />
                    Download Attached File
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-between items-center bg-white shrink-0 text-xs">
              <span className="text-muted">
                Uploaded by: <strong>{viewRecord.refereeInChargeName}</strong> (
                {viewRecord.championshipDate})
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadFile(viewRecord)}
                  className="bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  Download File
                </button>

                <button
                  type="button"
                  onClick={() => setViewRecord(null)}
                  className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-4 py-2 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ROSTER MODAL */}
      {viewRosterRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-primary p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Users size={18} />
                <h3 className="font-bold text-sm text-white m-0 uppercase tracking-tight truncate">
                  Referee Attendance Roster - {viewRosterRecord.championshipName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewRosterRecord(null)}
                className="text-white hover:text-gray-200 transition-colors p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                <div>
                  <h4 className="font-bold text-sm text-primary uppercase m-0">
                    {viewRosterRecord.championshipName}
                  </h4>
                  <p className="text-xs text-muted m-0">
                    {viewRosterRecord.location} | {viewRosterRecord.championshipDate}
                  </p>
                </div>
                <span className="bg-primary/10 text-primary font-bold text-xs px-3 py-1 rounded-full">
                  {viewRosterRecord.refereesList.length} Referees
                </span>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-border text-muted font-bold uppercase">
                      <th className="p-3">#</th>
                      <th className="p-3">Referee Name</th>
                      <th className="p-3">TM Membership ID</th>
                      <th className="p-3">Role / Ring</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewRosterRecord.refereesList.map((item, idx) => (
                      <tr
                        key={item.id || idx}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="p-3 font-semibold text-muted">{idx + 1}</td>
                        <td className="p-3 font-bold uppercase text-primary">
                          {item.name}
                        </td>
                        <td className="p-3 font-mono font-bold">
                          {item.tmId || "-"}
                        </td>
                        <td className="p-3 font-medium">{item.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end bg-white shrink-0">
              <button
                type="button"
                onClick={() => setViewRosterRecord(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertCircle size={24} />
              </div>
              <h3 className="font-bold text-lg text-gray-900 m-0">Confirm Deletion</h3>
            </div>

            <p className="text-sm text-gray-600 m-0">
              Are you sure you want to permanently delete the championship attendance record for{" "}
              <strong className="text-gray-900">{recordToDelete.championshipName}</strong>?
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRecord}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
