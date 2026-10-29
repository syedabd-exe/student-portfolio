
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, EmailStr


class StudentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=150)
    department: str = Field(min_length=1, max_length=100)
    college: Optional[str] = Field(default=None, max_length=150)
    bio: Optional[str] = None
    skills: Optional[str] = None


class StudentOut(BaseModel):
    id: int
    name: str
    email: str
    department: str
    college: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1)
    category: Literal["achievement", "activity", "project"]
    technologies: Optional[str] = Field(default=None, max_length=300)
    link: Optional[str] = Field(default=None, max_length=500)
    student_id: int


class ItemUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=150)
    description: Optional[str] = None
    category: Optional[
        Literal["achievement", "activity", "project"]
    ] = None
    technologies: Optional[str] = Field(default=None, max_length=300)
    link: Optional[str] = Field(default=None, max_length=500)
    student_id: Optional[int] = None


class ItemOut(BaseModel):
    id: int
    title: str
    description: str
    category: str
    technologies: Optional[str] = None
    link: Optional[str] = None
    student_id: int

    model_config = ConfigDict(from_attributes=True)


# Authentication schemas

class RegisterRequest(StudentCreate):
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=150)
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student: StudentOut
