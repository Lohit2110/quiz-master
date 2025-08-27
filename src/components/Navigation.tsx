import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';

const Navigation: React.FC = () => {
  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
      <Container>
        <LinkContainer to="/">
          <Navbar.Brand>
            <i className="fas fa-brain me-2"></i>
            Quiz Master
          </Navbar.Brand>
        </LinkContainer>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <LinkContainer to="/">
              <Nav.Link>
                <i className="fas fa-home me-1"></i>
                Home
              </Nav.Link>
            </LinkContainer>
            
            <LinkContainer to="/quiz-categories">
              <Nav.Link>
                <i className="fas fa-play me-1"></i>
                Take Quiz
              </Nav.Link>
            </LinkContainer>
            
            <LinkContainer to="/create-quiz">
              <Nav.Link>
                <i className="fas fa-plus-circle me-1"></i>
                Create Quiz
              </Nav.Link>
            </LinkContainer>
            
            <LinkContainer to="/admin">
              <Nav.Link>
                <i className="fas fa-cog me-1"></i>
                Admin Panel
              </Nav.Link>
            </LinkContainer>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
