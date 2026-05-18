import {
  User as UserIcon,
  FileText,
  CreditCard,
  Award,
  ShieldAlert,
  Settings,
  LogOut,
  Save,
  Lock,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db, auth, secondaryAuth } from "../firebase";
import {
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signOut as signOutSecondary,
} from "firebase/auth";
import Cropper from "react-easy-crop";

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: any,
): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });
  const canvas = document.createElement("canvas");
  // Maximum output size to prevent oversized base64
  const MAX_SIZE = 512;
  let scale = 1;
  if (pixelCrop.width > MAX_SIZE) {
    scale = MAX_SIZE / pixelCrop.width;
  }
  canvas.width = pixelCrop.width * scale;
  canvas.height = pixelCrop.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
};

const getRefereeLevelText = (level: string) => {
  if (!level) return "REFEREE";
  if (level.includes("IR")) return "INTERNATIONAL REFEREE";
  if (level.includes("SR")) return "NATIONAL REFEREE";
  if (level.includes("TR")) return "STATE REFEREE";
  return "REFEREE";
};

const RefereeCard = ({
  title,
  level,
  photo,
  name,
  idStr,
  stateClub,
  validThru,
}: any) => {
  const headerBgColor = title === "POOMSAE" ? "#b50000" : "#0265ad";
  const cardBgColor = title === "POOMSAE" ? "#FFF0F0" : "#F0F8FF";

  return (
    <div
      className="w-[340px] relative overflow-hidden border border-gray-200 flex flex-col font-sans mb-4 shrink-0"
      style={{
        backgroundColor: cardBgColor,
        boxShadow: "0 0 10px rgba(0,0,0,0.1)",
      }}
    >
      {/* Header */}
      <div
        className="pt-4 pb-16 flex flex-col items-center justify-center text-center relative text-white"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="bg-white p-2 rounded-lg mb-4 shadow-sm">
          <img
            src="https://upload.wikimedia.org/wikipedia/en/9/91/Taekwondo_Malaysia_logo.png"
            alt="TM"
            className="h-[55px] object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
        <h2 className="text-[22px] font-bold tracking-wide m-0 leading-tight uppercase">
          {title}
        </h2>
      </div>

      {/* Photo */}
      <div
        className="w-[130px] h-[150px] bg-[#E2E8F0] -mt-[60px] mx-auto mb-5 flex items-center justify-center relative z-10 overflow-hidden"
        style={{ borderRadius: "4px 4px 4px 4px" }}
      >
        {photo ? (
          <img src={photo} alt={name} className="w-full h-full object-cover" />
        ) : (
          <svg width="60" height="60" viewBox="0 0 24 24" fill="#CBD5E0">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        )}
      </div>

      {/* Details */}
      <div className="px-4 pb-4 text-center text-[#212529]">
        <p className="text-[15px] font-bold text-[#003366] uppercase tracking-[1px] m-0 mb-1">
          {name || "N/A"}
        </p>
        <h1
          className="text-[28px] font-bold uppercase tracking-tight m-0 leading-none mb-4 text-black"
          style={{ transform: "scaleY(1.05)", letterSpacing: "-0.5px" }}
        >
          {level}
        </h1>

        <p
          className="font-mono font-bold text-[14px] tracking-[3px] text-[#8ea3b8] m-0 mb-3 px-2 whitespace-nowrap"
          style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.05)" }}
        >
          {idStr || "TMXXXX-KIR-PIR-0001"}
        </p>

        {/* Footer Grid */}
        <div className="grid grid-cols-[1fr_120px] border-t border-gray-200 mt-3">
          <div className="flex flex-col items-center border-r border-gray-200 px-2 pt-3 pb-1 justify-center">
            <span className="text-[11px] text-black mb-1">STATE/CLUB</span>
            <span className="text-[13px] font-bold text-black uppercase text-center leading-tight truncate w-full">
              {stateClub || "N/A"}
            </span>
          </div>
          <div className="flex flex-col items-center px-2 pt-3 pb-1 justify-center">
            <span className="text-[10px] text-[#8ea3b8] uppercase mb-1 whitespace-nowrap">
              VALID THRU
            </span>
            <span className="text-[20px] font-medium text-[#8ea3b8]">
              {validThru || "YYYY"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function UserProfile({
  isAdminView = false,
}: {
  isAdminView?: boolean;
}) {
  const { id } = useParams(); // Only used if isAdminView is true
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("personal");
  const [userData, setUserData] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  const [photoForCrop, setPhotoForCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No authenticated user found");

      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPasswordSuccess("Password successfully updated.");
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      if (err.code === "auth/invalid-credential") {
        setPasswordError("Incorrect old password");
      } else if (err.code === "auth/weak-password") {
        setPasswordError("New password is too weak (min 6 characters)");
      } else {
        setPasswordError(err.message || "Failed to update password");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const [adminPasswordReset, setAdminPasswordReset] = useState("");
  const [adminPasswordResetLoading, setAdminPasswordResetLoading] =
    useState(false);
  const [adminDeleteLoading, setAdminDeleteLoading] = useState(false);
  const [showAdminDeleteConfirm, setShowAdminDeleteConfirm] = useState(false);

  const handleAdminDeleteAccount = async () => {
    if (!isAdminView || !userData) return;

    setAdminDeleteLoading(true);
    try {
      const cleanTMId = (userData.tmMembershipId || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

      const collectionsList = ["experience", "annual_fees", "promotions", "bans"];
      for (const collName of collectionsList) {
        const collRef = collection(db, "users", id as string, collName);
        const docsSnap = await getDocs(collRef);
        for (const docSnap of docsSnap.docs) {
          await deleteDoc(doc(collRef, docSnap.id));
        }
      }

      if (cleanTMId) {
        await deleteDoc(doc(db, "login_mappings", cleanTMId));
      }
      
      await deleteDoc(doc(db, "users", id as string));

      alert("Account successfully deleted. Redirecting to admin area...");
      navigate("/admin", { replace: true });
    } catch (error: any) {
      console.error(error);
      alert("Failed to delete account: " + error.message);
    } finally {
      setAdminDeleteLoading(false);
    }
  };

  const handleAdminPasswordResetAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminView || !userData) return;
    if (adminPasswordReset.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setAdminPasswordResetLoading(true);
    try {
      const cleanTMId = (userData.tmMembershipId || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      if (!cleanTMId) {
        alert(
          "This user does not have a valid TM Membership ID. Please assign one before resetting their password.",
        );
        setAdminPasswordResetLoading(false);
        return;
      }
      const newDummyEmail = `${cleanTMId}_${Date.now()}@tmreferee.local`;

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newDummyEmail,
        adminPasswordReset,
      );
      const newUid = userCredential.user.uid;
      await signOutSecondary(secondaryAuth);

      const newUserDoc = { ...userData, uid: newUid, email: newDummyEmail };
      await setDoc(doc(db, "users", newUid), newUserDoc);

      const collectionsList = [
        "experience",
        "annual_fees",
        "promotions",
        "bans",
      ];
      for (const collName of collectionsList) {
        const oldRef = collection(db, "users", id as string, collName);
        const newRef = collection(db, "users", newUid, collName);
        const docsSnap = await getDocs(oldRef);
        for (const docSnap of docsSnap.docs) {
          await setDoc(doc(newRef, docSnap.id), docSnap.data());
        }
      }

      await setDoc(doc(db, "login_mappings", cleanTMId), {
        email: newDummyEmail,
        uid: newUid,
      });
      await deleteDoc(doc(db, "users", id as string));

      setAdminPasswordReset("");
      alert("Password reset successfully! Redirecting...");
      navigate(`/admin/user/${newUid}`, { replace: true });
    } catch (error: any) {
      console.error(error);
      alert("Failed to reset password: " + error.message);
    } finally {
      setAdminPasswordResetLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = isAdminView ? id : auth.currentUser?.uid;
        if (!userId) return;

        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setEditedData(data);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id, isAdminView]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleInputChange = (field: string, value: any) => {
    setEditedData({ ...editedData, [field]: value });
  };

  const handleSave = async () => {
    const userId = isAdminView ? id : auth.currentUser?.uid;
    if (!userId) return;

    setSaveLoading(true);
    try {
      await updateDoc(doc(db, "users", userId), editedData);

      // Update mapping if TM ID changed
      if (
        isAdminView &&
        userData.tmMembershipId &&
        editedData.tmMembershipId &&
        editedData.tmMembershipId !== userData.tmMembershipId
      ) {
        const oldClean = userData.tmMembershipId
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase();
        const newClean = editedData.tmMembershipId
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase();

        const mappingDoc = await getDoc(doc(db, "login_mappings", oldClean));
        let emailToUse = `${oldClean}@tmreferee.local`;
        if (mappingDoc.exists() && mappingDoc.data().email) {
          emailToUse = mappingDoc.data().email;
        }
        await setDoc(doc(db, "login_mappings", newClean), {
          email: emailToUse,
          uid: userId,
        });
      }

      setUserData(editedData);
      setIsEditing(false);
      alert("Details updated successfully!");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update details.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setPhotoForCrop(event.target.result);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSaveCrop = async () => {
    if (photoForCrop && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(
          photoForCrop,
          croppedAreaPixels,
        );
        handleInputChange("photoUrl", croppedImage);
        setPhotoForCrop(null);
      } catch (e) {
        console.error(e);
        alert("Failed to crop image");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        User not found.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Sidebar Tabs */}
      <aside className="w-[260px] bg-white border-r border-border flex flex-col shrink-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 bg-primary [clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)] shrink-0"></div>
          <div className="text-[16px] font-extrabold tracking-[-0.5px] uppercase text-primary leading-tight">
            TM Referee
            <br />
            Registry
          </div>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-2">
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 px-4">
            Menu
          </div>

          <button
            onClick={() => setActiveTab("personal")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
              activeTab === "personal"
                ? "bg-primary text-white"
                : "text-muted hover:bg-gray-50"
            }`}
          >
            <UserIcon size={18} />
            Personal Info
          </button>

          <button
            onClick={() => setActiveTab("experience")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
              activeTab === "experience"
                ? "bg-primary text-white"
                : "text-muted hover:bg-gray-50"
            }`}
          >
            <FileText size={18} />
            Experience
          </button>

          <button
            onClick={() => setActiveTab("annual_fee")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
              activeTab === "annual_fee"
                ? "bg-primary text-white"
                : "text-muted hover:bg-gray-50"
            }`}
          >
            <CreditCard size={18} />
            Annual Fee
          </button>

          <button
            onClick={() => setActiveTab("promotion")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
              activeTab === "promotion"
                ? "bg-primary text-white"
                : "text-muted hover:bg-gray-50"
            }`}
          >
            <Award size={18} />
            Promotion
          </button>

          {isAdminView && (
            <>
              <button
                onClick={() => setActiveTab("ban")}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
                  activeTab === "ban"
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-gray-50"
                }`}
              >
                <ShieldAlert size={18} />
                Ban History
              </button>
              <button
                onClick={() => setActiveTab("account")}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${
                  activeTab === "account"
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-gray-50"
                }`}
              >
                <Lock size={18} />
                Account & Login
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-border flex flex-col gap-2">
          {isAdminView && (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors text-muted hover:bg-gray-50 w-full"
            >
              ← Back to Admin
            </button>
          )}
          {!isAdminView && (
            <>
              <button
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors text-muted hover:bg-gray-50 w-full"
              >
                <Lock size={18} />
                Change Password
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors text-red-600 hover:bg-red-50 w-full"
              >
                <LogOut size={18} />
                Logout
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          <header className="flex justify-between items-center pb-6 border-b-2 border-primary mb-6">
            <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">
              {activeTab === "personal" && "Personal Information"}
              {activeTab === "experience" && "Referee Experience"}
              {activeTab === "annual_fee" && "Annual Fee History"}
              {activeTab === "promotion" && "Promotion History"}
              {activeTab === "ban" && "Ban History"}
              {activeTab === "account" && "Account Settings"}
            </h1>
            <div className="flex gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-primary text-white px-4 py-2 rounded font-bold text-sm hover:bg-primary/90 transition-colors"
                >
                  Edit Details
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="bg-success text-white px-4 py-2 rounded font-bold text-sm hover:opacity-90 transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  {saveLoading ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </header>

          {activeTab === "personal" && (
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 h-full">
              {/* Left Column */}
              <div className="flex flex-col gap-4">
                {/* Digital ID Cards */}
                {isEditing ? (
                  <div className="w-[340px] h-[480px] bg-card rounded-2xl relative overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.1)] border border-border flex flex-col">
                    <div className="pt-6 pb-14 bg-[#F8FAFC] flex flex-col items-center justify-center text-center relative border-b-[3px] border-primary">
                      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_top,black_10%,transparent_80%)]"></div>

                      {/* TM Logo Representation */}
                      <div className="relative z-10 flex flex-col items-center justify-center mb-1">
                        <img
                          src="https://upload.wikimedia.org/wikipedia/en/9/91/Taekwondo_Malaysia_logo.png"
                          alt="Taekwondo Malaysia Logo"
                          className="h-[60px] object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove(
                              "hidden",
                            );
                          }}
                        />
                        <div
                          className="hidden font-black text-5xl italic tracking-tighter"
                          style={{
                            background:
                              "linear-gradient(135deg, #F97316 0%, #F97316 35%, #000 35%, #000 65%, #F97316 65%, #F97316 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          TM
                        </div>
                      </div>

                      <h3 className="m-0 text-[13px] tracking-widest text-[#1a202c] font-black uppercase z-10">
                        TAEKWONDO MALAYSIA
                      </h3>
                    </div>

                    <div className="w-[160px] h-[160px] bg-[#E2E8F0] -mt-[50px] mx-auto mb-4 border-[6px] border-white rounded-lg flex items-center justify-center relative z-10 overflow-hidden group">
                      {editedData.photoUrl || userData.photoUrl ? (
                        <img
                          src={editedData.photoUrl || userData.photoUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          width="80"
                          height="80"
                          viewBox="0 0 24 24"
                          fill="#CBD5E0"
                        >
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      )}
                      <label className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                        <span className="text-[12px] font-bold">
                          Upload Photo
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>

                    <div className="px-6 pb-6 text-center">
                      <input
                        type="text"
                        value={editedData.fullName}
                        onChange={(e) =>
                          handleInputChange("fullName", e.target.value)
                        }
                        className="text-[18px] font-bold m-0 mb-1 w-full text-center border-b border-primary focus:outline-none"
                        placeholder="Full Name"
                      />

                      <div className="flex flex-col items-center mb-5 gap-2 w-full px-4 mt-2">
                        <input
                          type="text"
                          value={editedData.tmMembershipId || ""}
                          onChange={(e) =>
                            handleInputChange("tmMembershipId", e.target.value)
                          }
                          disabled={!isAdminView}
                          placeholder="TMXXXX"
                          className="font-mono text-muted text-[14px] w-full text-center border-b border-primary focus:outline-none disabled:bg-transparent"
                        />
                        <div className="flex gap-2 w-full justify-center text-[12px]">
                          <div className="flex items-center gap-1">
                            <span className="font-bold">K</span>
                            <select
                              value={editedData.kyorugiRefereeLevel || "IR"}
                              onChange={(e) =>
                                handleInputChange(
                                  "kyorugiRefereeLevel",
                                  e.target.value,
                                )
                              }
                              disabled={!isAdminView}
                              className="font-mono text-muted border-b border-primary focus:outline-none bg-transparent disabled:opacity-100 appearance-none"
                            >
                              <option value="TR">TR</option>
                              <option value="SR">SR</option>
                              <option value="IR3">IR3</option>
                              <option value="IR2">IR2</option>
                              <option value="IR1">IR1</option>
                              <option value="IR">IR</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold">P</span>
                            <select
                              value={editedData.poomsaeRefereeLevel || "IR"}
                              onChange={(e) =>
                                handleInputChange(
                                  "poomsaeRefereeLevel",
                                  e.target.value,
                                )
                              }
                              disabled={!isAdminView}
                              className="font-mono text-muted border-b border-primary focus:outline-none bg-transparent disabled:opacity-100 appearance-none"
                            >
                              <option value="TR">TR</option>
                              <option value="SR">SR</option>
                              <option value="IR3">IR3</option>
                              <option value="IR2">IR2</option>
                              <option value="IR1">IR1</option>
                              <option value="IR">IR</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold">-</span>
                            <input
                              type="text"
                              value={editedData.refereeSerialNumber || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "refereeSerialNumber",
                                  e.target.value,
                                )
                              }
                              disabled={!isAdminView}
                              placeholder="0001"
                              className="font-mono text-muted w-12 text-center border-b border-primary focus:outline-none disabled:bg-transparent"
                            />
                          </div>
                        </div>
                        <div className="font-mono text-muted text-[12px] w-full text-center mt-3 pt-3 border-t border-gray-100">
                          VALID THRU: {(() => {
                            const fees = editedData.annualFeeHistory || [];
                            if (!fees.length) return userData.lastAnnualFeeYear || "YYYY";
                            const years = fees.map((f: any) => parseInt(f.year)).filter((y: number) => !isNaN(y));
                            return years.length ? Math.max(...years).toString() : (userData.lastAnnualFeeYear || "YYYY");
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {(userData.kyorugiRefereeLevel ||
                      (!userData.kyorugiRefereeLevel &&
                        !userData.poomsaeRefereeLevel)) && (
                      <RefereeCard
                        title="KYORUGI"
                        level={getRefereeLevelText(
                          userData.kyorugiRefereeLevel || "IR",
                        )}
                        photo={userData.photoUrl}
                        name={userData.fullName}
                        idStr={
                          userData.tmMembershipId
                            ? `${userData.tmMembershipId}-K${userData.kyorugiRefereeLevel || "IR"}-P${userData.poomsaeRefereeLevel || "IR"}-${userData.refereeSerialNumber || "0001"}`
                            : "TMXXXX-KIR-PIR-0001"
                        }
                        stateClub={
                          userData.premierClub || userData.stateAssociation
                        }
                        validThru={(() => {
                          const fees = userData.annualFeeHistory || [];
                          if (!fees.length) return userData.lastAnnualFeeYear;
                          const years = fees.map((f: any) => parseInt(f.year)).filter((y: number) => !isNaN(y));
                          return years.length ? Math.max(...years).toString() : userData.lastAnnualFeeYear;
                        })()}
                      />
                    )}
                    {userData.poomsaeRefereeLevel && (
                      <RefereeCard
                        title="POOMSAE"
                        level={getRefereeLevelText(
                          userData.poomsaeRefereeLevel || "IR",
                        )}
                        photo={userData.photoUrl}
                        name={userData.fullName}
                        idStr={
                          userData.tmMembershipId
                            ? `${userData.tmMembershipId}-K${userData.kyorugiRefereeLevel || "IR"}-P${userData.poomsaeRefereeLevel || "IR"}-${userData.refereeSerialNumber || "0001"}`
                            : "TMXXXX-KIR-PIR-0001"
                        }
                        stateClub={
                          userData.premierClub || userData.stateAssociation
                        }
                        validThru={(() => {
                          const fees = userData.annualFeeHistory || [];
                          if (!fees.length) return userData.lastAnnualFeeYear;
                          const years = fees.map((f: any) => parseInt(f.year)).filter((y: number) => !isNaN(y));
                          return years.length ? Math.max(...years).toString() : userData.lastAnnualFeeYear;
                        })()}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Right Column */}
              <div className="grid grid-rows-[auto_1fr_auto] gap-5">
                {/* Identity & Contact */}
                <div className="bg-white border border-border rounded-lg p-5">
                  <div className="text-[12px] uppercase font-bold text-muted mb-4 flex items-center justify-between">
                    <span>Identity & Contact</span>
                    {isEditing ? (
                      <select
                        value={editedData.isActive ? "true" : "false"}
                        onChange={(e) =>
                          handleInputChange(
                            "isActive",
                            e.target.value === "true" ? true : false,
                          )
                        }
                        disabled={!isAdminView}
                        className={`px-2 py-[2px] rounded-full text-[11px] font-bold uppercase cursor-pointer disabled:cursor-default disabled:opacity-100 ${editedData.isActive ? "bg-[#C6F6D5] text-[#22543D]" : "bg-gray-200 text-gray-600"}`}
                      >
                        <option value="true">ACTIVE MEMBER</option>
                        <option value="false">INACTIVE</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-[2px] rounded-full text-[11px] font-bold uppercase ${userData.isActive ? "bg-[#C6F6D5] text-[#22543D]" : "bg-gray-200 text-gray-600"}`}
                      >
                        {userData.isActive ? "ACTIVE MEMBER" : "INACTIVE"}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="flex flex-col">
                      <label className="block text-[11px] text-muted mb-1">
                        IC Number
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedData.icNumber || ""}
                          onChange={(e) =>
                            handleInputChange("icNumber", e.target.value)
                          }
                          className="font-semibold text-[14px] border-b border-primary focus:outline-none"
                        />
                      ) : (
                        <p className="m-0 font-semibold text-[14px]">
                          {userData.icNumber || "N/A"}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-[11px] text-muted mb-1">
                        Date of Birth
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedData.dateOfBirth || ""}
                          onChange={(e) =>
                            handleInputChange("dateOfBirth", e.target.value)
                          }
                          className="font-semibold text-[14px] border-b border-primary focus:outline-none"
                        />
                      ) : (
                        <p className="m-0 font-semibold text-[14px]">
                          {userData.dateOfBirth || "N/A"}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-[11px] text-muted mb-1">
                        Gender
                      </label>
                      {isEditing ? (
                        <select
                          value={editedData.gender || ""}
                          onChange={(e) =>
                            handleInputChange("gender", e.target.value)
                          }
                          className="font-semibold text-[14px] border-b border-primary focus:outline-none bg-white"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      ) : (
                        <p className="m-0 font-semibold text-[14px]">
                          {userData.gender || "N/A"}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-[11px] text-muted mb-1">
                        Phone Number
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedData.phoneNumber || ""}
                          onChange={(e) =>
                            handleInputChange("phoneNumber", e.target.value)
                          }
                          className="font-semibold text-[14px] border-b border-primary focus:outline-none"
                        />
                      ) : (
                        <p className="m-0 font-semibold text-[14px]">
                          {userData.phoneNumber || "N/A"}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-[11px] text-muted mb-1">
                        Email Address
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editedData.email || ""}
                          onChange={(e) =>
                            handleInputChange("email", e.target.value)
                          }
                          className="font-semibold text-[14px] border-b border-primary focus:outline-none"
                        />
                      ) : (
                        <p className="m-0 font-semibold text-[14px]">
                          {userData.email}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-[11px] text-muted mb-1">
                        Club Affiliation
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedData.premierClub || ""}
                          onChange={(e) =>
                            handleInputChange("premierClub", e.target.value)
                          }
                          className="font-semibold text-[14px] border-b border-primary focus:outline-none"
                        />
                      ) : (
                        <p className="m-0 font-semibold text-[14px]">
                          {userData.premierClub || "N/A"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seminar & Qualification History */}
                <div className="bg-white border border-border rounded-lg p-5">
                  <div className="text-[12px] uppercase font-bold text-muted mb-4 flex items-center justify-between">
                    <span>Seminar & Qualification History</span>
                    {isEditing && isAdminView && (
                      <button
                        onClick={() => {
                          const newHistory = [
                            ...(editedData.seminarHistory || []),
                          ];
                          newHistory.push({
                            id: Date.now().toString(),
                            year: "",
                            location: "",
                            level: "",
                            result: "",
                          });
                          handleInputChange("seminarHistory", newHistory);
                        }}
                        className="text-primary text-[11px] font-bold"
                      >
                        + ADD ROW
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse mt-2">
                      <thead>
                        <tr>
                          <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                            Year
                          </th>
                          <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                            Location / Event
                          </th>
                          <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                            Level
                          </th>
                          <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                            Result
                          </th>
                          {isEditing && isAdminView && (
                            <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border"></th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(isEditing
                          ? editedData.seminarHistory || []
                          : userData.seminarHistory || []
                        ).map((item: any, index: number) => (
                          <tr key={item.id || index}>
                            <td className="p-2.5 px-2 text-[13px] border-b border-border">
                              {isEditing && isAdminView ? (
                                <input
                                  className="w-full border-b border-primary focus:outline-none"
                                  value={item.year}
                                  onChange={(e) => {
                                    const newHistory = [
                                      ...editedData.seminarHistory,
                                    ];
                                    newHistory[index].year = e.target.value;
                                    handleInputChange(
                                      "seminarHistory",
                                      newHistory,
                                    );
                                  }}
                                  placeholder="YYYY"
                                />
                              ) : (
                                item.year
                              )}
                            </td>
                            <td className="p-2.5 px-2 text-[13px] border-b border-border">
                              {isEditing && isAdminView ? (
                                <input
                                  className="w-full border-b border-primary focus:outline-none"
                                  value={item.location}
                                  onChange={(e) => {
                                    const newHistory = [
                                      ...editedData.seminarHistory,
                                    ];
                                    newHistory[index].location = e.target.value;
                                    handleInputChange(
                                      "seminarHistory",
                                      newHistory,
                                    );
                                  }}
                                  placeholder="Event Name"
                                />
                              ) : (
                                item.location
                              )}
                            </td>
                            <td className="p-2.5 px-2 text-[13px] border-b border-border">
                              {isEditing && isAdminView ? (
                                <input
                                  className="w-full border-b border-primary focus:outline-none"
                                  value={item.level}
                                  onChange={(e) => {
                                    const newHistory = [
                                      ...editedData.seminarHistory,
                                    ];
                                    newHistory[index].level = e.target.value;
                                    handleInputChange(
                                      "seminarHistory",
                                      newHistory,
                                    );
                                  }}
                                  placeholder="Level"
                                />
                              ) : (
                                item.level
                              )}
                            </td>
                            <td className="p-2.5 px-2 text-[13px] border-b border-border flex items-center justify-between">
                              {isEditing && isAdminView ? (
                                <input
                                  className="w-full border-b border-primary focus:outline-none"
                                  value={item.result}
                                  onChange={(e) => {
                                    const newHistory = [
                                      ...editedData.seminarHistory,
                                    ];
                                    newHistory[index].result = e.target.value;
                                    handleInputChange(
                                      "seminarHistory",
                                      newHistory,
                                    );
                                  }}
                                  placeholder="PASS/FAIL"
                                />
                              ) : (
                                <span
                                  className={
                                    item.result?.toUpperCase() === "PASS"
                                      ? "text-success font-semibold"
                                      : item.result?.toUpperCase() === "FAIL"
                                        ? "text-red-500 font-semibold"
                                        : "text-muted"
                                  }
                                >
                                  {item.result?.toUpperCase()}
                                </span>
                              )}
                            </td>
                            {isEditing && isAdminView && (
                              <td className="p-2.5 px-2 text-[13px] border-b border-border text-right">
                                <button
                                  onClick={() => {
                                    const newHistory =
                                      editedData.seminarHistory.filter(
                                        (_: any, i: number) => i !== index,
                                      );
                                    handleInputChange(
                                      "seminarHistory",
                                      newHistory,
                                    );
                                  }}
                                  className="text-red-500 font-bold"
                                >
                                  X
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {(!userData.seminarHistory ||
                          userData.seminarHistory.length === 0) &&
                          !isEditing && (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-4 text-center text-muted text-[13px] border-b border-border"
                              >
                                No history available.
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[#FFF5F5] border border-[#FED7D7] text-[#C53030] p-3 rounded text-[13px] flex items-center gap-2.5 mt-3">
                    <div className="w-2 h-2 bg-current rounded-full shrink-0"></div>
                    <div>
                      <strong>License Expiry Warning:</strong> This referee's
                      annual TM license expires soon.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "experience" && (
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="text-[12px] uppercase font-bold text-muted mb-4 flex items-center justify-between">
                <span>Referee Experience</span>
                {isEditing && (
                  <button
                    onClick={() => {
                      const newExp = [...(editedData.experienceHistory || [])];
                      newExp.push({
                        id: Date.now().toString(),
                        year: "",
                        eventName: "",
                        location: "",
                        role: "",
                      });
                      handleInputChange("experienceHistory", newExp);
                    }}
                    className="text-primary text-[11px] font-bold"
                  >
                    + ADD EXPERIENCE
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse mt-2">
                  <thead>
                    <tr>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Year
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Event Name
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Location
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Role / Responsibility
                      </th>
                      {isEditing && (
                        <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing
                      ? editedData.experienceHistory || []
                      : userData.experienceHistory || []
                    ).map((item: any, index: number) => (
                      <tr key={item.id || index}>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.year}
                              onChange={(e) => {
                                const newExp = [
                                  ...editedData.experienceHistory,
                                ];
                                newExp[index].year = e.target.value;
                                handleInputChange("experienceHistory", newExp);
                              }}
                              placeholder="YYYY"
                            />
                          ) : (
                            item.year
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.eventName}
                              onChange={(e) => {
                                const newExp = [
                                  ...editedData.experienceHistory,
                                ];
                                newExp[index].eventName = e.target.value;
                                handleInputChange("experienceHistory", newExp);
                              }}
                              placeholder="Tournament/Event"
                            />
                          ) : (
                            item.eventName
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.location}
                              onChange={(e) => {
                                const newExp = [
                                  ...editedData.experienceHistory,
                                ];
                                newExp[index].location = e.target.value;
                                handleInputChange("experienceHistory", newExp);
                              }}
                              placeholder="City/State"
                            />
                          ) : (
                            item.location
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.role}
                              onChange={(e) => {
                                const newExp = [
                                  ...editedData.experienceHistory,
                                ];
                                newExp[index].role = e.target.value;
                                handleInputChange("experienceHistory", newExp);
                              }}
                              placeholder="Role"
                            />
                          ) : (
                            item.role
                          )}
                        </td>
                        {isEditing && (
                          <td className="p-2.5 px-2 text-[13px] border-b border-border text-right">
                            <button
                              onClick={() => {
                                const newExp =
                                  editedData.experienceHistory.filter(
                                    (_: any, i: number) => i !== index,
                                  );
                                handleInputChange("experienceHistory", newExp);
                              }}
                              className="text-red-500 font-bold"
                            >
                              X
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {(!userData.experienceHistory ||
                      userData.experienceHistory.length === 0) &&
                      !isEditing && (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-4 text-center text-muted text-[13px] border-b border-border"
                          >
                            No experience uploaded yet.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "annual_fee" && (
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="text-[12px] uppercase font-bold text-muted mb-4 flex items-center justify-between">
                <span>Annual Fee History</span>
                {isEditing && (
                  <button
                    onClick={() => {
                      const newFees = [...(editedData.annualFeeHistory || [])];
                      newFees.push({
                        id: Date.now().toString(),
                        year: "",
                        datePaid: "",
                        amount: "",
                        receiptNo: "",
                      });
                      handleInputChange("annualFeeHistory", newFees);
                    }}
                    className="text-primary text-[11px] font-bold"
                  >
                    + ADD RECORD
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse mt-2">
                  <thead>
                    <tr>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Year
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Date Paid
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Amount
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Receipt No.
                      </th>
                      {isEditing && (
                        <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing
                      ? editedData.annualFeeHistory || []
                      : userData.annualFeeHistory || []
                    ).map((item: any, index: number) => (
                      <tr key={item.id || index}>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.year}
                              onChange={(e) => {
                                const newFees = [
                                  ...editedData.annualFeeHistory,
                                ];
                                newFees[index].year = e.target.value;
                                handleInputChange("annualFeeHistory", newFees);
                              }}
                              placeholder="YYYY"
                            />
                          ) : (
                            item.year
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              type="date"
                              value={item.datePaid}
                              onChange={(e) => {
                                const newFees = [
                                  ...editedData.annualFeeHistory,
                                ];
                                newFees[index].datePaid = e.target.value;
                                handleInputChange("annualFeeHistory", newFees);
                              }}
                            />
                          ) : (
                            item.datePaid
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.amount}
                              onChange={(e) => {
                                const newFees = [
                                  ...editedData.annualFeeHistory,
                                ];
                                newFees[index].amount = e.target.value;
                                handleInputChange("annualFeeHistory", newFees);
                              }}
                              placeholder="RM"
                            />
                          ) : (
                            item.amount
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.receiptNo}
                              onChange={(e) => {
                                const newFees = [
                                  ...editedData.annualFeeHistory,
                                ];
                                newFees[index].receiptNo = e.target.value;
                                handleInputChange("annualFeeHistory", newFees);
                              }}
                              placeholder="Receipt No"
                            />
                          ) : (
                            item.receiptNo
                          )}
                        </td>
                        {isEditing && (
                          <td className="p-2.5 px-2 text-[13px] border-b border-border text-right">
                            <button
                              onClick={() => {
                                const newFees =
                                  editedData.annualFeeHistory.filter(
                                    (_: any, i: number) => i !== index,
                                  );
                                handleInputChange("annualFeeHistory", newFees);
                              }}
                              className="text-red-500 font-bold"
                            >
                              X
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {(!userData.annualFeeHistory ||
                      userData.annualFeeHistory.length === 0) &&
                      !isEditing && (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-4 text-center text-muted text-[13px] border-b border-border"
                          >
                            No fee records found.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "promotion" && (
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="text-[12px] uppercase font-bold text-muted mb-4 flex items-center justify-between">
                <span>Promotion History</span>
                {isEditing && (
                  <button
                    onClick={() => {
                      const newPromotions = [
                        ...(editedData.promotionHistory || []),
                      ];
                      newPromotions.push({
                        id: Date.now().toString(),
                        date: "",
                        category: "",
                        levelAchieved: "",
                        remarks: "",
                      });
                      handleInputChange("promotionHistory", newPromotions);
                    }}
                    className="text-primary text-[11px] font-bold"
                  >
                    + ADD RECORD
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse mt-2">
                  <thead>
                    <tr>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Date
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Category
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Level Achieved
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Remarks
                      </th>
                      {isEditing && (
                        <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing
                      ? editedData.promotionHistory || []
                      : userData.promotionHistory || []
                    ).map((item: any, index: number) => (
                      <tr key={item.id || index}>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              type="date"
                              value={item.date}
                              onChange={(e) => {
                                const newPromotions = [
                                  ...editedData.promotionHistory,
                                ];
                                newPromotions[index].date = e.target.value;
                                handleInputChange(
                                  "promotionHistory",
                                  newPromotions,
                                );
                              }}
                            />
                          ) : (
                            item.date
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <select
                              className="w-full border-b border-primary focus:outline-none bg-transparent"
                              value={item.category}
                              onChange={(e) => {
                                const newPromotions = [
                                  ...editedData.promotionHistory,
                                ];
                                newPromotions[index].category = e.target.value;
                                handleInputChange(
                                  "promotionHistory",
                                  newPromotions,
                                );
                              }}
                            >
                              <option value="">Select</option>
                              <option value="Kyorugi">Kyorugi</option>
                              <option value="Poomsae">Poomsae</option>
                            </select>
                          ) : (
                            item.category
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.levelAchieved}
                              onChange={(e) => {
                                const newPromotions = [
                                  ...editedData.promotionHistory,
                                ];
                                newPromotions[index].levelAchieved =
                                  e.target.value;
                                handleInputChange(
                                  "promotionHistory",
                                  newPromotions,
                                );
                              }}
                              placeholder="e.g. IR 1st Class"
                            />
                          ) : (
                            item.levelAchieved
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.remarks}
                              onChange={(e) => {
                                const newPromotions = [
                                  ...editedData.promotionHistory,
                                ];
                                newPromotions[index].remarks = e.target.value;
                                handleInputChange(
                                  "promotionHistory",
                                  newPromotions,
                                );
                              }}
                              placeholder="Remarks"
                            />
                          ) : (
                            item.remarks
                          )}
                        </td>
                        {isEditing && (
                          <td className="p-2.5 px-2 text-[13px] border-b border-border text-right">
                            <button
                              onClick={() => {
                                const newPromotions =
                                  editedData.promotionHistory.filter(
                                    (_: any, i: number) => i !== index,
                                  );
                                handleInputChange(
                                  "promotionHistory",
                                  newPromotions,
                                );
                              }}
                              className="text-red-500 font-bold"
                            >
                              X
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {(!userData.promotionHistory ||
                      userData.promotionHistory.length === 0) &&
                      !isEditing && (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-4 text-center text-muted text-[13px] border-b border-border"
                          >
                            No promotion records found.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "ban" && (
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="text-[12px] uppercase font-bold text-muted mb-4 flex items-center justify-between">
                <span className="text-red-600">Ban History</span>
                {isAdminView && isEditing && (
                  <button
                    onClick={() => {
                      const newBans = [...(editedData.banHistory || [])];
                      newBans.push({
                        id: Date.now().toString(),
                        date: "",
                        reason: "",
                        duration: "",
                        status: "",
                      });
                      handleInputChange("banHistory", newBans);
                    }}
                    className="text-primary text-[11px] font-bold"
                  >
                    + ADD RECORD
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse mt-2">
                  <thead>
                    <tr>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Date
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Reason
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Duration
                      </th>
                      <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border">
                        Status
                      </th>
                      {isEditing && isAdminView && (
                        <th className="text-left font-normal text-[11px] text-muted p-2 border-b border-border"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing
                      ? editedData.banHistory || []
                      : userData.banHistory || []
                    ).map((item: any, index: number) => (
                      <tr key={item.id || index}>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing && isAdminView ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              type="date"
                              value={item.date}
                              onChange={(e) => {
                                const newBans = [...editedData.banHistory];
                                newBans[index].date = e.target.value;
                                handleInputChange("banHistory", newBans);
                              }}
                            />
                          ) : (
                            item.date
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing && isAdminView ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.reason}
                              onChange={(e) => {
                                const newBans = [...editedData.banHistory];
                                newBans[index].reason = e.target.value;
                                handleInputChange("banHistory", newBans);
                              }}
                              placeholder="Reason"
                            />
                          ) : (
                            item.reason
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing && isAdminView ? (
                            <input
                              className="w-full border-b border-primary focus:outline-none"
                              value={item.duration}
                              onChange={(e) => {
                                const newBans = [...editedData.banHistory];
                                newBans[index].duration = e.target.value;
                                handleInputChange("banHistory", newBans);
                              }}
                              placeholder="e.g. 6 Months"
                            />
                          ) : (
                            item.duration
                          )}
                        </td>
                        <td className="p-2.5 px-2 text-[13px] border-b border-border">
                          {isEditing && isAdminView ? (
                            <select
                              className="w-full border-b border-primary focus:outline-none bg-transparent"
                              value={item.status}
                              onChange={(e) => {
                                const newBans = [...editedData.banHistory];
                                newBans[index].status = e.target.value;
                                handleInputChange("banHistory", newBans);
                              }}
                            >
                              <option value="">Select</option>
                              <option value="Active">Active</option>
                              <option value="Lifted">Lifted</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${item.status === "Active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                            >
                              {item.status}
                            </span>
                          )}
                        </td>
                        {isEditing && isAdminView && (
                          <td className="p-2.5 px-2 text-[13px] border-b border-border text-right">
                            <button
                              onClick={() => {
                                const newBans = editedData.banHistory.filter(
                                  (_: any, i: number) => i !== index,
                                );
                                handleInputChange("banHistory", newBans);
                              }}
                              className="text-red-500 font-bold"
                            >
                              X
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {(!userData.banHistory ||
                      userData.banHistory.length === 0) &&
                      !isEditing && (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-4 text-center text-muted text-[13px] border-b border-border"
                          >
                            No ban records found.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "account" && isAdminView && (
            <div className="bg-white border text-left border-border rounded-lg p-8">
              <h3 className="text-lg font-bold text-primary mb-4 border-b border-border pb-2">
                Change Password
              </h3>
              <p className="text-sm text-muted mb-6">
                Change the user's password. This process will seamlessly migrate
                their backend account. The user will be able to log in with
                their existing TM Membership ID and the newly provided password.
              </p>
              <form
                onSubmit={handleAdminPasswordResetAction}
                className="max-w-sm flex flex-col gap-4"
              >
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={adminPasswordReset}
                    onChange={(e) => setAdminPasswordReset(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={adminPasswordResetLoading}
                  className="bg-primary text-white px-4 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-70 mt-2"
                >
                  {adminPasswordResetLoading
                    ? "Resetting Password..."
                    : "Reset Password"}
                </button>
              </form>

              <div className="mt-12 pt-8 border-t border-border">
                <h3 className="text-lg font-bold text-red-600 mb-4 border-b border-red-200 pb-2">
                  Danger Zone
                </h3>
                <p className="text-sm text-muted mb-6">
                  Permanently delete this user account. This action cannot be undone and will erase all data associated with this user.
                </p>
                {!showAdminDeleteConfirm ? (
                  <button
                    onClick={() => setShowAdminDeleteConfirm(true)}
                    disabled={adminDeleteLoading}
                    className="bg-white border-2 border-red-600 text-red-600 px-4 py-3 rounded-lg font-bold hover:bg-red-50 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 max-w-sm"
                  >
                    <LogOut size={16} />
                    Delete Account
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-5 max-w-md">
                    <p className="text-red-800 font-bold mb-4">Are you absolutely sure? This cannot be undone.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleAdminDeleteAccount}
                        disabled={adminDeleteLoading}
                        className="bg-red-600 text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors flex-1"
                      >
                        {adminDeleteLoading ? "Deleting..." : "Yes, Delete It"}
                      </button>
                      <button
                        onClick={() => setShowAdminDeleteConfirm(false)}
                        disabled={adminDeleteLoading}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md font-bold hover:bg-gray-50 transition-colors flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab !== "personal" &&
            activeTab !== "experience" &&
            activeTab !== "annual_fee" &&
            activeTab !== "promotion" &&
            activeTab !== "ban" &&
            activeTab !== "account" && (
              <div className="bg-white border border-border rounded-lg p-12 text-center text-muted flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Settings size={24} className="text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-primary mb-2">
                  Under Construction
                </h2>
                <p className="max-w-md">
                  The {activeTab.replace("_", " ")} module is currently being
                  developed. Please check back later.
                </p>
              </div>
            )}
        </div>
      </main>

      {/* Crop Modal */}
      {photoForCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-lg">Adjust Photo</h3>
              <button
                onClick={() => setPhotoForCrop(null)}
                className="text-muted hover:text-black font-bold"
              >
                X
              </button>
            </div>
            <div className="relative h-[300px] w-full bg-black">
              <Cropper
                image={photoForCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase mb-2 block">
                  Zoom
                </label>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPhotoForCrop(null)}
                  className="px-4 py-2 text-sm font-bold text-muted hover:text-black"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCrop}
                  className="px-4 py-2 bg-primary text-white rounded font-bold text-sm"
                >
                  Save Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-primary p-4 text-white">
              <h3 className="font-bold tracking-tight m-0 flex items-center gap-2">
                <Lock size={18} />
                Change Password
              </h3>
            </div>
            <form
              onSubmit={handleChangePassword}
              className="p-6 flex flex-col gap-4"
            >
              {passwordError && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-sm font-medium border border-red-100">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 text-green-600 p-3 rounded text-sm font-medium border border-green-100">
                  {passwordSuccess}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase">
                  Current Password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="px-3 py-2 border border-border rounded focus:outline-none focus:border-primary text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="px-3 py-2 border border-border rounded focus:outline-none focus:border-primary text-sm"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-bold text-muted hover:text-black transition-colors"
                >
                  Close
                </button>
                {!passwordSuccess && (
                  <button
                    type="submit"
                    disabled={passwordLoading || !oldPassword || !newPassword}
                    className="bg-primary text-white px-4 py-2 rounded text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
