import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from jose import JWTError, jwt

from .database import get_db
from . import models, schemas


router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)

password_hasher = PasswordHash.recommended()

# Default fallback key for local dev environment
SECRET_KEY = os.getenv("STUDENT_PORTFOLIO_SECRET_KEY", "dev_secret_key_student_portfolio_2026")
ALGORITHM = "HS256"


def get_current_student(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> models.Student:
    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or missing access token",
        headers={"WWW-Authenticate": "Bearer"}
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        sub = payload.get("sub")
        if sub is None:
            raise unauthorized
        student_id = int(sub)
    except (JWTError, TypeError, ValueError):
        raise unauthorized

    student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if student is None:
        raise unauthorized

    return student


protected_router = APIRouter(
    dependencies=[Depends(get_current_student)]
)


def create_access_token(student_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=2)

    return jwt.encode(
        {"sub": str(student_id), "exp": expires},
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# ========== AUTHENTICATION APIs ==========

@router.post("/auth/register", status_code=201)
def register(
    data: schemas.RegisterRequest,
    db: Session = Depends(get_db)
):
    email = str(data.email).lower()

    existing = db.query(models.Student).filter(
        models.Student.email == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    values = data.model_dump(exclude={"password"})
    values["email"] = email

    student = models.Student(**values)

    try:
        db.add(student)
        db.flush()

        account = models.AuthAccount(
            student_id=student.id,
            password_hash=password_hasher.hash(data.password)
        )

        db.add(account)
        db.commit()
        db.refresh(student)

        return {
            "message": "Registration successful",
            "student_id": student.id
        }

    except Exception:
        db.rollback()
        raise


@router.post("/auth/login", response_model=schemas.LoginResponse)
def login(
    data: schemas.LoginRequest,
    db: Session = Depends(get_db)
):
    email = str(data.email).lower()

    result = db.query(
        models.Student,
        models.AuthAccount
    ).join(
        models.AuthAccount,
        models.AuthAccount.student_id == models.Student.id
    ).filter(
        models.Student.email == email
    ).first()

    if not result:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    student, account = result

    if not password_hasher.verify(
        data.password,
        account.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    return {
        "access_token": create_access_token(student.id),
        "token_type": "bearer",
        "student": student
    }


# ========== STUDENT APIs ==========

@protected_router.post(
    "/students",
    response_model=schemas.StudentOut,
    status_code=201
)
def create_student(
    student: schemas.StudentCreate,
    db: Session = Depends(get_db)
):
    email = str(student.email).lower()

    existing = db.query(models.Student).filter(
        models.Student.email == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    values = student.model_dump()
    values["email"] = email

    new_student = models.Student(**values)

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return new_student


@protected_router.get("/students", response_model=list[schemas.StudentOut])
def get_students(db: Session = Depends(get_db)):
    return db.query(models.Student).all()


@protected_router.get("/students/{student_id}", response_model=schemas.StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db)
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return student


@protected_router.put(
    "/students/{student_id}",
    response_model=schemas.StudentOut
)
def update_student(
    student_id: int,
    data: schemas.StudentCreate,
    db: Session = Depends(get_db)
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    email = str(data.email).lower()

    existing_email = db.query(models.Student).filter(
        models.Student.email == email,
        models.Student.id != student_id
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    values = data.model_dump()
    values["email"] = email

    for key, value in values.items():
        setattr(student, key, value)

    db.commit()
    db.refresh(student)

    return student


@protected_router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db)
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    db.delete(student)
    db.commit()

    return {"message": "Student deleted successfully"}


# ========== PORTFOLIO ITEM APIs ==========

@protected_router.post(
    "/items",
    response_model=schemas.ItemOut,
    status_code=201
)
def create_item(
    item: schemas.ItemCreate,
    db: Session = Depends(get_db)
):
    student = db.query(models.Student).filter(
        models.Student.id == item.student_id
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    new_item = models.PortfolioItem(**item.model_dump())

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return new_item


@protected_router.get("/items", response_model=list[schemas.ItemOut])
def get_items(
    student_id: int | None = None,
    category: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.PortfolioItem)

    if student_id is not None:
        query = query.filter(
            models.PortfolioItem.student_id == student_id
        )

    if category is not None:
        if category not in ["achievement", "activity", "project"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid category"
            )

        query = query.filter(
            models.PortfolioItem.category == category
        )

    return query.all()


@protected_router.get("/items/{item_id}", response_model=schemas.ItemOut)
def get_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    item = db.query(models.PortfolioItem).filter(
        models.PortfolioItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item not found"
        )

    return item


@protected_router.patch(
    "/items/{item_id}",
    response_model=schemas.ItemOut
)
def update_item(
    item_id: int,
    data: schemas.ItemUpdate,
    db: Session = Depends(get_db)
):
    item = db.query(models.PortfolioItem).filter(
        models.PortfolioItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item not found"
        )

    changes = data.model_dump(exclude_unset=True)

    for key, value in changes.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)

    return item


@protected_router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    item = db.query(models.PortfolioItem).filter(
        models.PortfolioItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item not found"
        )

    db.delete(item)
    db.commit()

    return {"message": "Portfolio item deleted successfully"}