import React from 'react';
import { Navbar, Nav, Container, Badge, Dropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // Hide navigation during quiz
  if (location.pathname === '/quiz') {
    return null;
  }

  // Role-based access
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  const handleLogout = () => {
    logout();
  };

  return (
    <Navbar className="navbar-modern" expand="lg" sticky="top">
      <Container>
        <LinkContainer to="/">
          <Navbar.Brand className="navbar-brand-modern d-flex align-items-center">
            <div className="brand-icon">
              <i className="fas fa-brain"></i>
            </div>
            <span className="brand-text">Quiz Master</span>
          </Navbar.Brand>
        </LinkContainer>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" className="navbar-toggler-modern">
          <span className="toggler-icon"></span>
        </Navbar.Toggle>
        
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto nav-links-modern">
            <LinkContainer to="/">
              <Nav.Link className="nav-link-modern">
                <i className="fas fa-home"></i>
                <span>Home</span>
              </Nav.Link>
            </LinkContainer>
            
            <LinkContainer to="/quiz-categories">
              <Nav.Link className="nav-link-modern">
                <i className="fas fa-play"></i>
                <span>Take Quiz</span>
              </Nav.Link>
            </LinkContainer>
            
            {/* Admin-only features */}
            {isAdmin && (
              <LinkContainer to="/create-quiz">
                <Nav.Link className="nav-link-modern">
                  <i className="fas fa-plus-circle"></i>
                  <span>Create Quiz</span>
                </Nav.Link>
              </LinkContainer>
            )}
            
            {/* Data Sync available to all authenticated users */}
            <LinkContainer to="/data-sync">
              <Nav.Link className="nav-link-modern">
                <i className="fas fa-sync-alt"></i>
                <span>Data Sync</span>
              </Nav.Link>
            </LinkContainer>
            
            {/* Admin-only features */}
            {isAdmin && (
              <LinkContainer to="/admin">
                <Nav.Link className="nav-link-modern">
                  <i className="fas fa-cog"></i>
                  <span>Admin Panel</span>
                </Nav.Link>
              </LinkContainer>
            )}
          </Nav>
          
          <Nav>
            <Dropdown align="end" className="user-dropdown">
              <Dropdown.Toggle className="user-dropdown-toggle" id="user-dropdown">
                <div className="user-avatar">
                  <i className="fas fa-user"></i>
                </div>
                {isStudent && <Badge className="role-badge student">Student</Badge>}
                {isAdmin && <Badge className="role-badge admin">Admin</Badge>}
              </Dropdown.Toggle>

              <Dropdown.Menu className="user-dropdown-menu">
                <Dropdown.ItemText>
                  <div className="user-info">
                    <i className="fas fa-user-circle me-2"></i>
                    <span>Logged in as <strong>{user?.role}</strong></span>
                  </div>
                </Dropdown.ItemText>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout} className="logout-item">
                  <i className="fas fa-sign-out-alt me-2"></i>
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
