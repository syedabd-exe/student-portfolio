
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False)
    college = Column(String(150), nullable=True)
    bio = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)

    items = relationship(
        "PortfolioItem",
        back_populates="student",
        cascade="all, delete-orphan"
    )

    auth_account = relationship(
        "AuthAccount",
        back_populates="student",
        cascade="all, delete-orphan",
        uselist=False
    )


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(30), nullable=False)
    technologies = Column(String(300), nullable=True)
    link = Column(String(500), nullable=True)

    student_id = Column(
        Integer,
        ForeignKey("students.id"),
        nullable=False
    )

    student = relationship("Student", back_populates="items")


class AuthAccount(Base):
    __tablename__ = "auth_accounts"

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(
        Integer,
        ForeignKey("students.id"),
        unique=True,
        nullable=False
    )

    password_hash = Column(String(255), nullable=False)

    student = relationship(
        "Student",
        back_populates="auth_account"
    )
